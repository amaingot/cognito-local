import crypto from "crypto";
import fs from "fs";
import path from "path";

export interface KeyPair {
  privateKey: crypto.KeyObject;
  publicKey: crypto.KeyObject;
  jwk: crypto.JsonWebKey & { kid: string; use: string; alg: string };
}

const KID = "cognito-local-key-1";

export function loadOrGenerateKeys(dataDir: string): KeyPair {
  fs.mkdirSync(dataDir, { recursive: true });
  const keyPath = path.join(dataDir, "keys.json");

  let privateKey: crypto.KeyObject;
  let publicKey: crypto.KeyObject;

  if (fs.existsSync(keyPath)) {
    const keys = JSON.parse(fs.readFileSync(keyPath, "utf8"));
    privateKey = crypto.createPrivateKey(keys.private);
    publicKey = crypto.createPublicKey(keys.public);
    console.log("Loaded existing signing keys from disk");
  } else {
    const pair = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 });
    privateKey = pair.privateKey;
    publicKey = pair.publicKey;
    fs.writeFileSync(
      keyPath,
      JSON.stringify({
        private: privateKey.export({ format: "pem", type: "pkcs8" }),
        public: publicKey.export({ format: "pem", type: "spki" }),
      })
    );
    console.log("Generated and saved new signing keys");
  }

  const jwk = publicKey.export({ format: "jwk" }) as crypto.JsonWebKey & {
    kid: string;
    use: string;
    alg: string;
  };
  jwk.kid = KID;
  jwk.use = "sig";
  jwk.alg = "RS256";

  return { privateKey, publicKey, jwk };
}

export function getKid(): string {
  return KID;
}
