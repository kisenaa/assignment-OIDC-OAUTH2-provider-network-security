# create volume
sudo docker volume create keycloak-data

# create and attach network so that keycloak can talk to 389ds container
sudo docker network create iam-network
sudo docker network connect iam-network 389ds

# without https
sudo docker run -d \
  --name keycloak \
  --network iam-network \
  -p 8080:8080 \
  -v keycloak-data:/opt/keycloak/data \
  -e KC_BOOTSTRAP_ADMIN_USERNAME=admin \
  -e KC_BOOTSTRAP_ADMIN_PASSWORD=admin \
  quay.io/keycloak/keycloak:latest \
  start-dev

# with https
sudo docker run -d \
  --name keycloak \
  --network iam-network \
  -p 8080:8080 \
  -p 8443:8443 \
  -v keycloak-data:/opt/keycloak/data \
  -v "$(pwd):/opt/keycloak/conf/certs:ro" \
  -e KC_BOOTSTRAP_ADMIN_USERNAME=admin \
  -e KC_BOOTSTRAP_ADMIN_PASSWORD=admin \
  -e KC_HTTPS_CERTIFICATE_FILE=/opt/keycloak/conf/certs/server.crt \
  -e KC_HTTPS_CERTIFICATE_KEY_FILE=/opt/keycloak/conf/certs/server.key \
  -e KC_TRUSTSTORE_PATHS=/opt/keycloak/conf/certs/ca.crt \
  quay.io/keycloak/keycloak:latest \
  start-dev

sudo docker exec -it keycloak bash -c "timeout 1 bash -c '</dev/tcp/389ds/3389' && echo 'PORT OPEN' || echo 'PORT CLOSED'"

# add CA cert to keycloak truststore
sudo docker exec -it --user root keycloak bash
keytool -delete -alias ldap-ca -cacerts -storepass changeit
keytool -importcert -trustcacerts -alias ldap-ca \
  -file /opt/keycloak/conf/certs/ca.crt \
  -cacerts \
  -storepass changeit
keytool -list -cacerts -storepass changeit | grep ldap-ca

sudo docker restart keycloak