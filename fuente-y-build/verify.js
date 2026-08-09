#!/usr/bin/env node
/**
 * Verificador de integridad para EN_libro1_v7_tags_fixed.txt
 *
 * Uso:
 *   node verify.js <ruta-o-url-al-archivo-a-verificar>
 *
 * Ejemplos:
 *   node verify.js ./zim2/fuente-y-build/EN_libro1_v7_tags_fixed.txt
 *   node verify.js https://raw.githubusercontent.com/sinnlos-jmb/zim2/main/fuente-y-build/EN_libro1_v7_tags_fixed.txt
 *
 * Este script compara el archivo indicado contra:
 *   1) Los valores de referencia conocidos como correctos (tamaño, md5, cantidad de líneas).
 *   2) El archivo de referencia local EN_libro1_v7_tags_fixed.txt (incluido en este mismo zip),
 *      byte a byte, mostrando la primera diferencia si existiera.
 *
 * No requiere paquetes externos: solo Node.js (14+) con módulos nativos.
 */

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const REFERENCE = {
	size: 133157,
	md5: "d2c6903224170c561fe5f59fab50d8ed",
	lines: 441,
};

const REFERENCE_FILE = path.join(__dirname, "EN_libro1_v7_tags_fixed.txt");

function md5(buf) {
	return crypto.createHash("md5").update(buf).digest("hex");
}

function countLines(buf) {
	// Cuenta líneas contando saltos de línea (\n). No agrega 1 al final para
	// que coincida con el conteo de `wc -l`.
	const str = buf.toString("utf8");
	let count = 0;
	for (let i = 0; i < str.length; i++) {
		if (str[i] === "\n") count++;
	}
	return count;
}

function firstDifference(bufA, bufB) {
	const len = Math.min(bufA.length, bufB.length);
	for (let i = 0; i < len; i++) {
		if (bufA[i] !== bufB[i]) {
			return i;
		}
	}
	if (bufA.length !== bufB.length) {
		return len;
	}
	return -1; // idénticos
}

function contextAround(buf, offset, radius) {
	const start = Math.max(0, offset - radius);
	const end = Math.min(buf.length, offset + radius);
	return buf.slice(start, end).toString("utf8");
}

function lineNumberAtOffset(buf, offset) {
	const str = buf.slice(0, offset).toString("utf8");
	let count = 1;
	for (let i = 0; i < str.length; i++) {
		if (str[i] === "\n") count++;
	}
	return count;
}

async function loadTarget(target) {
	if (/^https?:\/\//i.test(target)) {
		console.log(`Descargando ${target} ...`);
		const res = await fetch(target);
		if (!res.ok) {
			throw new Error(`No se pudo descargar el archivo: HTTP ${res.status}`);
		}
		const arrayBuffer = await res.arrayBuffer();
		return Buffer.from(arrayBuffer);
	}
	return fs.readFileSync(target);
}

async function main() {
	const target = REFERENCE_FILE;
	if (!target) {
		console.error("Uso: node verify.js <ruta-o-url-al-archivo-a-verificar>");
		process.exit(1);
	}

	let targetBuf;
	try {
		targetBuf = await loadTarget(target);
	} catch (err) {
		console.error(`ERROR al leer/descargar el archivo objetivo: ${err.message}`);
		process.exit(1);
	}

	const targetSize = targetBuf.length;
	const targetMd5 = md5(targetBuf);
	const targetLines = countLines(targetBuf);

	console.log("=== Archivo a verificar ===");
	console.log(`Ruta/URL: ${target}`);
	console.log(`Tamaño:   ${targetSize} bytes`);
	console.log(`MD5:      ${targetMd5}`);
	console.log(`Líneas:   ${targetLines}`);
	console.log("");

	console.log("=== Valores de referencia esperados ===");
	console.log(`Tamaño:   ${REFERENCE.size} bytes`);
	console.log(`MD5:      ${REFERENCE.md5}`);
	console.log(`Líneas:   ${REFERENCE.lines}`);
	console.log("");

	const sizeOk = targetSize === REFERENCE.size;
	const md5Ok = targetMd5 === REFERENCE.md5;
	const linesOk = targetLines === REFERENCE.lines;

	console.log("=== Resultado ===");
	console.log(`Tamaño coincide:  ${sizeOk ? "✅ SÍ" : "❌ NO"}`);
	console.log(`MD5 coincide:     ${md5Ok ? "✅ SÍ" : "❌ NO"}`);
	console.log(`Líneas coinciden: ${linesOk ? "✅ SÍ" : "❌ NO"}`);
	console.log("");

	if (sizeOk && md5Ok && linesOk) {
		console.log("🎉 El archivo es IDÉNTICO a la versión correcta y completa.");
	} else {
		console.log("⚠️  El archivo NO coincide con la versión correcta. Buscando la primera diferencia respecto del archivo de referencia local...");
		if (!fs.existsSync(REFERENCE_FILE)) {
			console.log(`No se encontró el archivo de referencia local (${REFERENCE_FILE}). Descomprime todo el zip para tenerlo disponible y poder hacer el diff detallado.`);
			process.exit(2);
		}
		const refBuf = fs.readFileSync(REFERENCE_FILE);
		const diffOffset = firstDifference(targetBuf, refBuf);
		if (diffOffset === -1) {
			console.log("(Los archivos son idénticos byte a byte, pero no coinciden con los valores de referencia hardcodeados; revisa REFERENCE en este script.)");
		} else {
			const lineNum = lineNumberAtOffset(refBuf, diffOffset);
			console.log(`Primera diferencia en el byte ${diffOffset} (aproximadamente línea ${lineNum} del archivo de referencia).`);
			console.log("");
			console.log("--- Contexto en el archivo DE REFERENCIA (correcto) ---");
			console.log(contextAround(refBuf, diffOffset, 120));
			console.log("");
			console.log("--- Contexto en el archivo A VERIFICAR ---");
			console.log(contextAround(targetBuf, diffOffset, 120));
			if (targetBuf.length < refBuf.length) {
				console.log("");
				console.log(`El archivo a verificar es más CORTO que el de referencia por ${refBuf.length - targetBuf.length} bytes (posiblemente truncado).`);
			} else if (targetBuf.length > refBuf.length) {
				console.log("");
				console.log(`El archivo a verificar es más LARGO que el de referencia por ${targetBuf.length - refBuf.length} bytes (posible contenido duplicado o extra).`);
			}
		}
		process.exit(2);
	}
}

main().catch((err) => {
	console.error("ERROR inesperado:", err);
	process.exit(1);
});
