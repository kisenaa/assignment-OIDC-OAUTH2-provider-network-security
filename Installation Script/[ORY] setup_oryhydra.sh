sudo cp "[ORY] hydra.yml" ./config/hydra.yml
sudo docker compose -f "[ORY] OryHydra-compose.yml" down
sudo docker compose -f "[ORY] OryHydra-compose.yml" up --build
sudo docker exec -it -u 0 oryhydra-hydra-1 sh -c "cp /cert/ca.crt ls && update-ca-certificates"

# NODE_TLS_REJECT_UNAUTHORIZED=0
# --skip-tls-verify

sudo docker exec -it oryhydra-hydra-1 \
hydra create --skip-tls-verify oauth2-client \
  --id hydra-client \
  --secret hydra-secret \
  --endpoint https://localhost:4445 \
  --grant-type authorization_code,refresh_token,client_credentials,implicit \
  --response-type token,code,id_token \
  --scope openid,offline \
  --redirect-uri https://api.elysia.com/auth/ory-hydra/callback

sudo docker exec -it oryhydra-hydra-1 hydra delete oauth2-client hydra-client --endpoint https://localhost:4445   --skip-tls-verify