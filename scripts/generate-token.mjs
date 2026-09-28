import {randomBytes,createHash} from 'node:crypto';
const token='BBP_'+randomBytes(32).toString('base64url');
console.log('Private token (copy once; do not commit or share logs): '+token);
console.log('Database token_hash: '+createHash('sha256').update(token).digest('hex'));
