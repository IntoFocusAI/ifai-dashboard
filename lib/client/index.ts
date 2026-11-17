/* Client settings: the accessor API (decision 105, X-35, parity chunk C1).

   Each client is one JSON settings file in data/clients/<client_key>.json, checked by
   lib/client/settings-schema.ts and listed in lib/client/registry.ts. Client differences come
   only from that record and the client's own data. Every accessor reads per call, never at
   import, so a server export (runWithClient in lib/client/server-client.ts) gets its own client.

   Lists and lookups
     listClients(): ClientSettings[]          every client's settings, in switcher order
     listClientKeys(): ClientKey[]            every client key, in switcher order
     getClientSettings(key): ClientSettings   one client's settings; throws for an unknown key
     clientProfile(key): ClientProfile        the camelCase profile screens read (brandName, schema...)
     clientKeyForSetAsideKey("fmic")          client key for a set_aside_key, or null

   Keys
     isClientKey(value)                       true for a key in data/clients/
     parseClientKey(value)                    a known key, else the default client
     defaultClientKey()                       the client with is_default (shown with no ?client=)
     clientKeyFromSearch("?client=x")         parseClientKey on the query parameter

   The brand on screen
     activeClientKey(), activeClient(), activeClientSettings(), brandName()
     clientHref(key, pathname), clientStorageKey(fenderKey)

   Validation
     validateClientSettings(raw, source)      checks one record; throws ClientSettingsError
     buildClientRegistry(files)               checks a set: each file, unique keys, one default

   Adding a client: write data/clients/<key>.json, add its logo under public/, and add the file to
   FILES in lib/client/registry.ts (a unit test fails until it is there). */

export {
  CLIENT_PARAM,
  activeClient,
  activeClientKey,
  activeClientSettings,
  brandName,
  clientHref,
  clientKeyForSetAsideKey,
  clientKeyFromSearch,
  clientProfile,
  clientStorageKey,
  defaultClientKey,
  getClientSettings,
  isClientKey,
  listClientKeys,
  listClients,
  parseClientKey,
  type ClientKey,
  type ClientProfile,
} from "./active-client";
export { buildClientRegistry, registeredClientFiles } from "./registry";
export {
  BUILT_SELLER_TYPES,
  ClientSettingsError,
  DATA_SOURCE_KEYS,
  SELLER_TYPES,
  validateClientSettings,
  type ClientAnalystEstimates,
  type ClientCompetitor,
  type ClientRetailer,
  type ClientSettings,
  type DataSourceKey,
  type SellerType,
} from "./settings-schema";
