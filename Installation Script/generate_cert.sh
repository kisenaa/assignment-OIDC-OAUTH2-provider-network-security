# CA private key (ECDSA P-256)
openssl ecparam -genkey -name prime256v1 -noout -out cert/ca.key

# Self-signed CA certificate
openssl req -x509 -new -nodes \
  -key cert/ca.key \
  -sha256 \
  -days 3650 \
  -out cert/ca.crt \
  -subj "/CN=elysia-ca"

# Server private key (ECDSA P-256)
openssl ecparam -genkey -name prime256v1 -noout -out cert/server.key

# Certificate signing request (CSR)
openssl req -new \
  -key cert/server.key \
  -out cert/server.csr \
  -config openssl.cnf

# Sign the server certificate with the CA
openssl x509 -req \
  -in cert/server.csr \
  -CA cert/ca.crt \
  -CAkey cert/ca.key \
  -CAcreateserial \
  -out cert/server.crt \
  -days 825 \
  -sha256 \
  -extensions req_ext \
  -extfile openssl.cnf

# whitelist CA
sudo cp cert/ca.crt /usr/local/share/ca-certificates/elysia-ca.crt
sudo update-ca-certificates