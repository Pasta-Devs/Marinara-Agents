import { cp } from "node:fs/promises";
import { isEnoent } from "./ltm-utils.js";
import { withLtmVaultLock } from "./vault-lock.js";
export async function copyLongTermMemoryBackupSnapshot(root:string,destinationRoot:string){return withLtmVaultLock(root,async()=>{try{await cp(root,destinationRoot,{recursive:true,errorOnExist:true,force:false});return true;}catch(e){if(isEnoent(e))return false;throw e;}});}
