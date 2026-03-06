#!/usr/bin/env node

import { pbkdf2Sync, randomBytes } from "node:crypto";

const iterations = 210000;
const keyLength = 32;
const password = process.argv[2];

if (!password) {
	console.error("用法：npm run hash:password -- 你的密码喵");
	process.exit(1);
}

const salt = randomBytes(16).toString("hex");
const hash = pbkdf2Sync(password, salt, iterations, keyLength, "sha256").toString(
	"hex",
);

console.log(`pbkdf2_sha256$${iterations}$${salt}$${hash}`);
