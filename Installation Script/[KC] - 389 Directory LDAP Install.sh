#!/usr/bin/env bash
set -e

CONTAINER_NAME="389ds"
VOLUME_NAME="389ds"
DM_PASSWORD="adminadmin"
BASE_DN="dc=elysia,dc=com"
LDAP_URI="ldap://localhost:3389"
LDAPS_URI="ldaps://localhost:3636"

sudo docker stop $CONTAINER_NAME 2>/dev/null || true
sudo docker rm -f $CONTAINER_NAME 2>/dev/null || true
sudo docker volume rm $VOLUME_NAME 2>/dev/null || true

# Create volume and run it
sudo docker volume create $VOLUME_NAME
sudo docker run -d \
  --name $CONTAINER_NAME \
  -p 3389:3389 \
  -p 3636:3636 \
  -v $VOLUME_NAME:/data \
  -e DS_DM_PASSWORD=$DM_PASSWORD \
  -e DS_SUFFIX="$BASE_DN" \
  389ds/dirsrv:latest


# copy certs to container and restart
sudo docker exec -it 389ds mkdir -p /data/tls/ca

sudo docker cp cert/server.key 389ds:/data/tls/server.key
sudo docker cp cert/server.crt 389ds:/data/tls/server.crt
sudo docker cp cert/ca.crt 389ds:/data/tls/ca/ca.crt

sudo docker exec -it 389ds chmod 600 /data/tls/server.key
sudo docker exec -it 389ds chmod 644 /data/tls/server.crt
sudo docker restart 389ds

# trust certs in container
sudo docker exec -it 389ds mkdir -p /etc/pki/trust/anchors
sudo docker exec -it 389ds cp /data/tls/ca/ca.crt /etc/pki/trust/anchors/elysia-ca.crt
sudo docker exec -it 389ds update-ca-certificates

# test connection
sudo docker logs -f 389ds
openssl s_client -connect localhost:3636

# create ldap suffix and base entries
sudo docker exec -it 389ds dsconf -v localhost backend create --suffix dc=elysia,dc=com --be-name elysia --create-suffix

# CREATE People OU 
ldapadd -x -D "cn=Directory Manager" -w $DM_PASSWORD -H $LDAP_URI <<EOF
dn: ou=People,$BASE_DN
objectClass: top
objectClass: organizationalUnit
ou: People
EOF
# or use this :
sudo docker exec -it 389ds dsidm localhost -b "dc=elysia,dc=com" organizationalunit create --ou People

# Create Groups OU
ldapadd -x -D "cn=Directory Manager" -w $DM_PASSWORD -H $LDAP_URI <<EOF
dn: ou=Groups,$BASE_DN
objectClass: top
objectClass: organizationalUnit
ou: Groups
EOF
# or use this :
sudo docker exec -it 389ds dsidm localhost -b "dc=elysia,dc=com" organizationalunit create --ou Groups

# ENABLE memberOf PLUGIN 
sudo docker exec -i $CONTAINER_NAME dsconf localhost -D "cn=Directory Manager" -w $DM_PASSWORD plugin memberof enable

# Restart
sudo docker restart $CONTAINER_NAME

# Create user John Doe
sudo docker exec -i 389ds dsidm -b "dc=elysia,dc=com" -w adminadmin localhost user create \
  --uid jdoe \
  --cn "John Doe" \
  --displayName "John Doe" \
  --uidNumber 1001 \
  --gidNumber 1001 \
  --homeDirectory /home/jdoe

# Create group and add John Doe as member
sudo docker exec -it 389ds dsidm -b "dc=elysia,dc=com" -w adminadmin localhost group create --cn test_group
sudo docker exec -it 389ds dsidm -b "dc=elysia,dc=com" -w adminadmin localhost group remove_member test_group "uid=jdoe,ou=People,dc=elysia,dc=com"
sudo docker exec -it 389ds dsidm -b "dc=elysia,dc=com" -w adminadmin localhost group add_member test_group \
  "uid=jdoe,ou=People,dc=elysia,dc=com"

# test auth and give read permission to self account
cat ldap_settings/self_read_permission.ldif | sudo docker exec -i 389ds ldapmodify -x \
  -H ldap://localhost:3389 \
  -D "cn=Directory Manager" \
  -w adminadmin

sudo docker exec -it 389ds ldapsearch -x \
  -H ldap://localhost:3389 \
  -D "uid=jdoe,ou=People,dc=elysia,dc=com" \
  -W -b "dc=elysia,dc=com" "(uid=jdoe)"

# Verify and testing utilities. no need to run these commands every time, just for debugging purpose
ldapwhoami -x \
  -D "cn=Directory Manager" \
  -w $DM_PASSWORD \
  -H $LDAPS_URI

  ldapwhoami -x \
  -D "cn=Directory Manager" \
  -w adminadmin \
  -H ldaps://localhost:3636

sudo docker exec -it 389ds dsidm localhost -b "dc=elysia,dc=com" ou list
sudo docker exec -it 389ds dsidm -b "dc=elysia,dc=com" -w adminadmin localhost user get jdoe

sudo docker exec -it 389ds ldapsearch -x \
  -H ldap://localhost:3389 \
  -D "cn=Directory Manager" \
  -w adminadmin \
  -b "dc=elysia,dc=com" \
  "(uid=jdoe)" dn

sudo docker exec -it 389ds ldapsearch -x \
  -H ldap://localhost:3389 \
  -D "cn=Directory Manager" \
  -w adminadmin \
  -b "dc=elysia,dc=com" \
  "(uid=jdoe)" dn objectClass
  
sudo docker exec -it 389ds ldapdelete -x \
  -H ldap://localhost:3389 \
  -D "cn=Directory Manager" \
  -w adminadmin \
  "uid=jdoe,ou=People,dc=elysia,dc=com"
  
# add mail and reset password to testtest
sudo docker exec -it 389ds dsidm -b "dc=elysia,dc=com" -w adminadmin localhost user modify jdoe \
  add:mail:john.doe@elysia.com
sudo docker exec -it 389ds dsidm -b "dc=elysia,dc=com" -w adminadmin localhost account reset_password "uid=jdoe,ou=People,dc=elysia,dc=com"