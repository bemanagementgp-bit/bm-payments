# bm-payments – cobros con Mercado Pago para Be Management Tools

Servicio serverless en Vercel (Node, **sin dependencias ni base de datos**) que cobra las licencias Pro de las 12 apps con **Mercado Pago** y emite claves de licencia firmadas.

## Cómo funciona

1. La app llama a `POST /api/checkout` con su `app` → el servicio crea una **preferencia de Checkout Pro** y devuelve `init_point`; el navegador va a Mercado Pago.
2. Mercado Pago cobra y redirige de vuelta a la app con `?mp=success&payment_id=…`.
3. La app llama a `GET /api/license?payment_id=…` → el servicio verifica el pago con la API de Mercado Pago y, si está **aprobado**, genera la clave `BM-APP-P<payment_id>-<firma>` (HMAC con `LICENSE_SECRET`). La app la activa sola y la muestra para guardar; si hay Resend configurado también la manda por mail.
4. Activar en otro dispositivo = pegar la clave → `POST /api/validate` verifica firma **y** vuelve a consultar el pago (un reembolso o contracargo revoca la clave). Las apps revalidan solas cada 7 días.
5. Suscripción mensual "Creative Pro" (todas las apps): `POST /api/subscribe` crea un **preapproval**; la clave `BM-ALL-S<id>-…` vale mientras la suscripción esté `authorized`.
6. `POST /api/webhook` recibe las notificaciones de Mercado Pago (firma verificada con `MP_WEBHOOK_SECRET`) y manda el mail de la clave como respaldo.

No se guarda nada: la clave es la prueba de pago. Cambiar `LICENSE_SECRET` invalida todas las claves emitidas.

## Endpoints

| Método | Ruta | Body / query | Respuesta |
|---|---|---|---|
| GET | `/api/health` | | qué variables están configuradas |
| GET | `/api/catalog?app=qrforge` | | precios formateados (ARS), bundle y suscripción |
| POST | `/api/checkout` | `{app, plan:"pro"\|"bundle", email?, return_url?}` | `{id, init_point, sandbox_init_point}` |
| GET | `/api/license?payment_id=…` | o `external_reference=` | `{key, app, title, emailed}` si el pago está aprobado |
| POST | `/api/validate` | `{key, app}` | `{valid, meta}` |
| POST | `/api/subscribe` | `{email, return_url?}` | `{id, init_point}` |
| GET | `/api/subscription?preapproval_id=…` | | `{status, key?}` |
| POST | `/api/subscription` | `{key, action:"cancel"\|"pause"\|"resume"}` | estado nuevo |
| POST | `/api/webhook` | notificación de Mercado Pago | `200` siempre |

Precios y nombres: `catalog.js`. Los `app` keys deben coincidir con `PAYMENTS.app` en el `config.js` de cada app (los pone `_shared/apply-brand.js`).

## Puesta en marcha (una vez)

1. **Credenciales de Mercado Pago**: en https://www.mercadopago.com.ar/developers → *Tus integraciones* → crear aplicación (tipo "Pagos online", Checkout Pro). Copiar el **Access Token** (primero el de **prueba**, después el de producción).
2. **Variables en Vercel** (proyecto `bm-payments` → Settings → Environment Variables), o con el CLI:
   ```bash
   cd bm-payments
   printf '%s' 'APP_USR-...tu-access-token...' | vercel env add MP_ACCESS_TOKEN production
   printf '%s' 'clave-secreta-del-webhook'     | vercel env add MP_WEBHOOK_SECRET production
   ```
   `LICENSE_SECRET` y `PAYMENTS_ORIGIN` ya quedaron cargados en el deploy inicial. Opcional: `RESEND_API_KEY` y `FROM_EMAIL` para mandar la clave por mail.
3. **Webhook**: en la aplicación de Mercado Pago → *Webhooks* → URL `https://bm-payments.vercel.app/api/webhook`, eventos **Pagos** y **Suscripciones**; copiar la clave secreta a `MP_WEBHOOK_SECRET`.
4. Redeploy: `vercel deploy --prod` (o un push).
5. **Probar en sandbox**: con el Access Token de prueba, abrí cualquier app → Pro → "Get Pro". Pagá con las [tarjetas de prueba](https://www.mercadopago.com.ar/developers/es/docs/checkout-pro/additional-content/your-integrations/test/cards) (APRO como nombre del titular = aprobado). Al volver, la app muestra la clave y queda en Pro. Pegá la clave en otra app distinta: debe rechazarla ("different product"); en la misma app en otro navegador: debe aceptarla.
6. Pasar a producción: reemplazar `MP_ACCESS_TOKEN` por el de producción y redeployar.

## Comisiones y plata

Mercado Pago cobra por transacción (porcentaje según plazo de liberación) y acredita en tu cuenta de Mercado Pago en ARS. Los precios de `catalog.js` están en ARS; ajustalos cuando cambie el tipo de cambio.

## Desarrollo local

```bash
cd bm-payments
cp .env.example .env   # completar
npm test               # tests offline del formato de licencia
vercel dev             # levanta las funciones en http://localhost:3000
```
