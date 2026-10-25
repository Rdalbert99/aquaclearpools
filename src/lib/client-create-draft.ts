// Session-local recovery is a request correlation draft, never billing authority.
// No password/token is stored. Exact frozen payload is retried through the scoped server.
export interface CreateDraft { requestId:string; payload:Record<string,unknown>|null; clientId:string|null }
export function createDraftStore(storage:Pick<Storage,'getItem'|'setItem'|'removeItem'>,actor:string){
 const key=`aqua-client-create:${actor}`;
 return {
  read():CreateDraft|null{try{const value=JSON.parse(storage.getItem(key)??'null');return value&&typeof value.requestId==='string'&&/^[0-9a-f-]{36}$/i.test(value.requestId)?value:null;}catch{return null;}},
  write(value:CreateDraft){storage.setItem(key,JSON.stringify(value));},
  clear(){storage.removeItem(key);},
 };
}
