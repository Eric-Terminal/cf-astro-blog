const PBKDF2_PREFIX = "pbkdf2_sha256";
const PBKDF2_ITERATIONS = 210000;
const PBKDF2_KEY_LENGTH = 32;

function bytesToHex(bytes: Uint8Array): string {
	return Array.from(bytes)
		.map((byte) => byte.toString(16).padStart(2, "0"))
		.join("");
}

function hexToBytes(value: string): Uint8Array {
	const normalized = value.trim();
	if (!/^[0-9a-f]+$/i.test(normalized) || normalized.length % 2 !== 0) {
		throw new Error("十六进制字符串格式不合法");
	}

	const bytes = new Uint8Array(normalized.length / 2);
	for (let index = 0; index < normalized.length; index += 2) {
		bytes[index / 2] = Number.parseInt(normalized.slice(index, index + 2), 16);
	}

	return bytes;
}

export function timingSafeEqualText(left: string, right: string): boolean {
	let diff = left.length ^ right.length;
	const maxLength = Math.max(left.length, right.length);

	for (let index = 0; index < maxLength; index += 1) {
		diff |= (left.charCodeAt(index) || 0) ^ (right.charCodeAt(index) || 0);
	}

	return diff === 0;
}

async function sha256Hex(value: string): Promise<string> {
	const encoded = new TextEncoder().encode(value);
	const digest = await crypto.subtle.digest("SHA-256", encoded);
	return bytesToHex(new Uint8Array(digest));
}

async function derivePbkdf2Hash(
	password: string,
	salt: string,
	iterations: number,
): Promise<string> {
	const keyMaterial = await crypto.subtle.importKey(
		"raw",
		new TextEncoder().encode(password),
		"PBKDF2",
		false,
		["deriveBits"],
	);

	const derivedBits = await crypto.subtle.deriveBits(
		{
			name: "PBKDF2",
			hash: "SHA-256",
			iterations,
			salt: new TextEncoder().encode(salt),
		},
		keyMaterial,
		PBKDF2_KEY_LENGTH * 8,
	);

	return bytesToHex(new Uint8Array(derivedBits));
}

export async function hashPassword(password: string): Promise<string> {
	const salt = crypto.randomUUID().replaceAll("-", "");
	const hash = await derivePbkdf2Hash(password, salt, PBKDF2_ITERATIONS);
	return `${PBKDF2_PREFIX}$${PBKDF2_ITERATIONS}$${salt}$${hash}`;
}

export function isLegacyPasswordHash(hash: string): boolean {
	return !hash.startsWith(`${PBKDF2_PREFIX}$`);
}

export async function verifyPassword(
	password: string,
	storedHash: string,
): Promise<boolean> {
	if (isLegacyPasswordHash(storedHash)) {
		const legacyHash = await sha256Hex(password);
		return timingSafeEqualText(legacyHash, storedHash);
	}

	const [prefix, iterationsText, salt, expectedHash] = storedHash.split("$");
	if (!prefix || !iterationsText || !salt || !expectedHash) {
		return false;
	}

	const iterations = Number.parseInt(iterationsText, 10);
	if (!Number.isInteger(iterations) || iterations <= 0) {
		return false;
	}

	try {
		hexToBytes(expectedHash);
	} catch {
		return false;
	}

	const derivedHash = await derivePbkdf2Hash(password, salt, iterations);
	return timingSafeEqualText(derivedHash, expectedHash);
}

export async function fingerprintPasswordHash(hash: string): Promise<string> {
	return sha256Hex(hash);
}
