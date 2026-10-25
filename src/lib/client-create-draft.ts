// On-device recovery is a request correlation draft, never billing authority.
// No password/token is stored. Exact frozen payload is retried through the scoped server.
export interface CreateDraft { requestId:string; payload:Record<string,unknown>|null; clientId:string|null; account?:Record<string,unknown>|null; createdAt?:number }
export function createDraftStore(storage:Pick<Storage,'getItem'|'setItem'|'removeItem'>,actor:string){
 const key=`aqua-client-create:${actor}`;
 return {
  read():CreateDraft|null{try{const value=JSON.parse(storage.getItem(key)??'null');if(value?.createdAt&&Date.now()-value.createdAt>7*24*60*60*1000){storage.removeItem(key);return null;}return value&&typeof value.requestId==='string'&&/^[0-9a-f-]{36}$/i.test(value.requestId)?value:null;}catch{return null;}},
  write(value:CreateDraft){storage.setItem(key,JSON.stringify({...value,createdAt:value.createdAt??Date.now()}));},
  clear(){storage.removeItem(key);},
 };
}
