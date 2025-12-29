# API Endpoints

Este documento describe todos los endpoints actuales del proyecto, con ejemplos, ordenes de ejecucion recomendadas y el detalle de los campos que se envian.

## Base

- Base URL: `http://localhost:3001` (o el host donde corra la API)
- Auth: `Authorization: Bearer <token>`
- Roles por workspace: `VIEWER < EDITOR < ADMIN < OWNER`
- Respuestas de error comunes:
  - `401`: token invalido o faltante
  - `403`: permisos insuficientes
  - `404`: recurso no encontrado
  - `409`: version conflict (optimistic locking)
  - `429`: rate limited

## Ordenes de ejecucion recomendadas

1) Onboarding basico
- `POST /auth/register`
- `POST /auth/login`
- `POST /workspaces`
- `GET /workspaces`
- `GET /workspaces/:workspaceId/tree`
- `POST /nodes` (crear folder/request)
- `PUT /workspaces/:workspaceId/requests/:nodeId` (editar request)
- `POST /runner/execute`

2) Colaboracion
- `POST /workspaces/:workspaceId/members/invite`
- `PATCH /workspaces/:workspaceId/members/:userId`
- `DELETE /workspaces/:workspaceId/members/:userId`
- `POST /workspaces/:workspaceId/leave`

3) Clonado
- `GET /workspaces/:workspaceId/tree`
- `POST /workspaces/:workspaceId/nodes/:nodeId/clone`
- `POST /workspaces/:workspaceId/nodes/:nodeId/clone-tree`

4) Postman import/export
- `POST /workspaces/:workspaceId/postman/import`
- `GET /workspaces/:workspaceId/postman/export`

5) Borrados
- `DELETE /workspaces/:workspaceId/nodes/:nodeId`
- `DELETE /workspaces/:workspaceId/requests/:nodeId`
- `DELETE /workspaces/:workspaceId`
- `DELETE /users/:userId` (solo admin global)

## SSE (eventos en tiempo real)

- `GET /workspaces/:workspaceId/events` (SSE)
- Eventos emitidos:
  - `node.created`
  - `node.updated`
  - `node.deleted`
  - `request.updated`
  - `tree.cloned`
  - `workspace.updated`
  - `workspace.deleted`

Ejemplo de evento SSE:
```
{
  "type": "node.created",
  "workspaceId": "...",
  "nodeId": "..."
}
```

## Auth

### POST /auth/register
- Permiso: publico
- Body:
  - `email` (string): correo del usuario
  - `password` (string): contrasena
  - `name` (string, opcional): nombre
- Respuesta:
  - `user`: `{ id, email, name }`
  - `token`

Ejemplo:
```bash
curl -s -X POST 'http://localhost:3001/auth/register' \
  -H 'Content-Type: application/json' \
  -d '{
    "email": "user@mail.com",
    "password": "secret",
    "name": "User"
  }'
```

### POST /auth/login
- Permiso: publico
- Body:
  - `email` (string)
  - `password` (string)
- Respuesta:
  - `user`: `{ id, email, name }`
  - `token`

Ejemplo:
```bash
curl -s -X POST 'http://localhost:3001/auth/login' \
  -H 'Content-Type: application/json' \
  -d '{
    "email": "user@mail.com",
    "password": "secret"
  }'
```

## Health

### GET /health
- Permiso: publico
- Respuesta: `{ ok: true }`

## Workspaces

### GET /workspaces
- Permiso: miembro
- Respuesta: lista de workspaces
  - `id` (string): workspaceId
  - `name` (string)
  - `role` (string): rol del usuario en ese workspace

Ejemplo:
```bash
curl -s -X GET 'http://localhost:3001/workspaces' \
  -H 'Authorization: Bearer <token>'
```

### POST /workspaces
- Permiso: usuario autenticado
- Body:
  - `name` (string): nombre del workspace
- Respuesta: `{ id, name }`

Ejemplo:
```bash
curl -s -X POST 'http://localhost:3001/workspaces' \
  -H 'Authorization: Bearer <token>' \
  -H 'Content-Type: application/json' \
  -d '{ "name": "Team" }'
```

### PATCH /workspaces/:workspaceId
- Permiso: OWNER
- Body:
  - `name` (string): nuevo nombre
- Respuesta: `{ ok: true, id, name }`

Ejemplo:
```bash
curl -s -X PATCH 'http://localhost:3001/workspaces/abc123' \
  -H 'Authorization: Bearer <token>' \
  -H 'Content-Type: application/json' \
  -d '{ "name": "Team v2" }'
```

### DELETE /workspaces/:workspaceId
- Permiso: OWNER
- Efecto: hard delete con cascada en `workspace_members` y `nodes`
- Respuesta: `{ ok: true }`

Ejemplo:
```bash
curl -s -X DELETE 'http://localhost:3001/workspaces/abc123' \
  -H 'Authorization: Bearer <token>'
```

## Members

### GET /workspaces/:workspaceId/members
- Permiso: VIEWER+
- Respuesta: lista de miembros
  - `userId`, `email`, `name`, `role`

### POST /workspaces/:workspaceId/members/invite
- Permiso: ADMIN+
- Body:
  - `email` (string): email del usuario
  - `role` (string): `OWNER|ADMIN|EDITOR|VIEWER`
- Respuesta: `{ workspaceId, userId, role }`

Ejemplo:
```bash
curl -s -X POST 'http://localhost:3001/workspaces/abc123/members/invite' \
  -H 'Authorization: Bearer <token>' \
  -H 'Content-Type: application/json' \
  -d '{ "email": "member@mail.com", "role": "EDITOR" }'
```

### PATCH /workspaces/:workspaceId/members/:userId
- Permiso: ADMIN+
- Reglas:
  - Solo OWNER puede asignar o quitar OWNER
  - No puedes dejar el workspace sin OWNER
- Body:
  - `role` (string): `OWNER|ADMIN|EDITOR|VIEWER`

Ejemplo:
```bash
curl -s -X PATCH 'http://localhost:3001/workspaces/abc123/members/u1' \
  -H 'Authorization: Bearer <token>' \
  -H 'Content-Type: application/json' \
  -d '{ "role": "ADMIN" }'
```

### DELETE /workspaces/:workspaceId/members/:userId
- Permiso: ADMIN+
- Reglas:
  - Solo OWNER puede expulsar a un OWNER
  - No puedes dejar el workspace sin OWNER

Ejemplo:
```bash
curl -s -X DELETE 'http://localhost:3001/workspaces/abc123/members/u1' \
  -H 'Authorization: Bearer <token>'
```

### POST /workspaces/:workspaceId/leave
- Permiso: cualquier miembro
- Regla: un OWNER no puede salir si queda sin OWNER

Ejemplo:
```bash
curl -s -X POST 'http://localhost:3001/workspaces/abc123/leave' \
  -H 'Authorization: Bearer <token>'
```

## Nodes / Tree

### GET /workspaces/:workspaceId/tree
- Permiso: VIEWER+
- Respuesta: lista plana ordenada
  - `id`
  - `parentId` (string|null)
  - `type` (`FOLDER|REQUEST`)
  - `name`
  - `sortOrder` (number)
  - `version` (number)
  - `method` (string|null)
  - `urlRaw` (string|null)

Ejemplo:
```bash
curl -s -X GET 'http://localhost:3001/workspaces/abc123/tree' \
  -H 'Authorization: Bearer <token>'
```

### POST /nodes
- Permiso: EDITOR+
- Body:
  - `workspaceId` (string): workspace destino
  - `parentId` (string|null): parent folder
  - `type` (string): `FOLDER|REQUEST`
  - `name` (string): nombre del nodo
  - `sortOrder` (number, opcional): orden dentro del parent
- Respuesta: `{ id }`

Ejemplo:
```bash
curl -s -X POST 'http://localhost:3001/nodes' \
  -H 'Authorization: Bearer <token>' \
  -H 'Content-Type: application/json' \
  -d '{
    "workspaceId": "abc123",
    "parentId": null,
    "type": "FOLDER",
    "name": "APIs",
    "sortOrder": 0
  }'
```

### PATCH /workspaces/:workspaceId/nodes/:nodeId
- Permiso: EDITOR+
- Body (opcionales):
  - `name` (string): renombrar
  - `parentId` (string|null): mover
  - `sortOrder` (number): reordenar
- Respuesta: `{ ok: true }`

Ejemplo:
```bash
curl -s -X PATCH 'http://localhost:3001/workspaces/abc123/nodes/n1' \
  -H 'Authorization: Bearer <token>' \
  -H 'Content-Type: application/json' \
  -d '{ "name": "APIs v2", "sortOrder": 2 }'
```

### DELETE /workspaces/:workspaceId/nodes/:nodeId
- Permiso: EDITOR+
- Efecto: borra el nodo y todos sus descendientes
- Respuesta: `{ ok: true, deleted }`

Ejemplo:
```bash
curl -s -X DELETE 'http://localhost:3001/workspaces/abc123/nodes/n1' \
  -H 'Authorization: Bearer <token>'
```

## Requests

### GET /workspaces/:workspaceId/requests/:nodeId
- Permiso: VIEWER+
- Respuesta:
  - `id`, `name`, `version`, `request`

Ejemplo:
```bash
curl -s -X GET 'http://localhost:3001/workspaces/abc123/requests/n2' \
  -H 'Authorization: Bearer <token>'
```

### PUT /workspaces/:workspaceId/requests/:nodeId
- Permiso: EDITOR+
- Optimistic locking: si `version` no coincide, retorna 409
- Body:
  - `version` (number): version actual del nodo
  - `method` (string): metodo HTTP (GET, POST, ...)
  - `urlRaw` (string): url base (sin query si usas `query`)
  - `headers` (array): lista de headers
  - `query` (array): lista de query params
  - `bodyType` (string): `none|raw|json|urlencoded|formdata|graphql`
  - `bodyRaw` (string|null): contenido raw/json
  - `bodyUrlEncoded` (array): items para urlencoded
  - `bodyFormData` (array): items para formdata
  - `bodyGraphql` (object|null): `{ query, variables }`
  - `authType` (string): `none|bearer|basic|apiKey|oauth2`
  - `auth` (object): datos de auth segun tipo

Campos de `headers` y `query`:
- `key` (string)
- `value` (string)
- `enabled` (boolean, opcional)

Campos de `bodyUrlEncoded` y `bodyFormData`:
- `key` (string)
- `value` (string)
- `enabled` (boolean, opcional)
- `type` (string, opcional)

Auth segun `authType`:
- `bearer`: `{ token }`
- `basic`: `{ username, password }`
- `apiKey`: `{ key, value, in }` donde `in` es `header` o `query`
- `oauth2`: `{ accessToken, ... }` (se envia como bearer)

Ejemplo:
```bash
curl -s -X PUT 'http://localhost:3001/workspaces/abc123/requests/n2' \
  -H 'Authorization: Bearer <token>' \
  -H 'Content-Type: application/json' \
  -d '{
    "version": 1,
    "method": "GET",
    "urlRaw": "https://api.example.com/users",
    "headers": [{ "key": "Accept", "value": "application/json" }],
    "query": [{ "key": "limit", "value": "10" }],
    "bodyType": "none",
    "authType": "bearer",
    "auth": { "token": "token123" }
  }'
```

### DELETE /workspaces/:workspaceId/requests/:nodeId
- Permiso: EDITOR+
- Alias de DELETE node para requests

## Clone

### POST /workspaces/:workspaceId/nodes/:nodeId/clone
- Permiso: EDITOR+
- Clona un request en un nuevo request (version 1)
- Body opcional:
  - `targetParentId` (string): parent destino
  - `name` (string): nombre nuevo
  - `includeAuth` (boolean): true por defecto

Ejemplo:
```bash
curl -s -X POST 'http://localhost:3001/workspaces/abc123/nodes/n2/clone' \
  -H 'Authorization: Bearer <token>' \
  -H 'Content-Type: application/json' \
  -d '{ "targetParentId": "f1", "name": "Request copy", "includeAuth": false }'
```

### POST /workspaces/:workspaceId/nodes/:nodeId/clone-tree
- Permiso: EDITOR+
- Clona un folder
- Body:
  - `targetParentId` (string): parent destino
  - `name` (string, opcional): nombre nuevo
  - `mode` (string): `deep` o `shallow`
    - `deep`: clona el folder y todo su subarbol
    - `shallow`: clona solo el folder

Ejemplo:
```bash
curl -s -X POST 'http://localhost:3001/workspaces/abc123/nodes/f1/clone-tree' \
  -H 'Authorization: Bearer <token>' \
  -H 'Content-Type: application/json' \
  -d '{ "targetParentId": "f2", "mode": "deep" }'
```

## Runner

### POST /runner/execute
- Permiso: VIEWER+
- Rate limit (configurable): por usuario
- Body:
  - `workspaceId` (string)
  - `nodeId` (string): request node
  - `timeoutMs` (number, opcional): 500-120000
- Respuesta:
  - `ok` (boolean)
  - `status`, `statusText`, `headers`, `body`, `timeMs`
  - `request`: `{ method, url, headers, body }`
  - `resolvedUrl` y `redirected`

Ejemplo:
```bash
curl -s -X POST 'http://localhost:3001/runner/execute' \
  -H 'Authorization: Bearer <token>' \
  -H 'Content-Type: application/json' \
  -d '{ "workspaceId": "abc123", "nodeId": "n2", "timeoutMs": 20000 }'
```

SSRF protection:
- Solo `http`/`https`
- Bloquea IPs privadas y hostnames internos
- Allowlist opcional con `RUNNER_ALLOWED_HOSTS`

## Postman

### POST /workspaces/:workspaceId/postman/import
- Permiso: EDITOR+
- Rate limit (configurable)
- Body: objeto Postman Collection v2.1
- Limite de items: `POSTMAN_IMPORT_MAX_ITEMS`
- Soporta auth: bearer, basic, apiKey, oauth2
- Soporta body: raw, json, urlencoded, formdata, graphql

Ejemplo (resumido):
```bash
curl -s -X POST 'http://localhost:3001/workspaces/abc123/postman/import' \
  -H 'Authorization: Bearer <token>' \
  -H 'Content-Type: application/json' \
  -d '{
    "info": { "name": "Demo" },
    "item": [
      {
        "name": "Get users",
        "request": {
          "method": "GET",
          "url": "https://api.example.com/users"
        }
      }
    ]
  }'
```

### GET /workspaces/:workspaceId/postman/export
- Permiso: VIEWER+
- Respuesta: Postman Collection v2.1

## Users

### DELETE /users/:userId
- Permiso: admin global
- Query:
  - `force` (boolean, opcional): si `true`, borra workspaces donde el user es OWNER
- Regla default (sin force): si es OWNER de algun workspace, falla con `owner_required`

Ejemplo:
```bash
curl -s -X DELETE 'http://localhost:3001/users/u1?force=true' \
  -H 'Authorization: Bearer <token>'
```

Admin global:
- `ADMIN_USER_IDS` o `ADMIN_EMAILS` en env

