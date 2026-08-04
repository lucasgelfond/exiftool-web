import { WASI, WASIProcExit, PreopenDirectory, File, Fd } from '@bjorn3/browser_wasi_shim';
import { instantiate } from './asyncify.js';
import { fetchZeroPerl } from './fetch-zeroperl';

class CustomFd extends Fd {
	private collectedOutput = '';

	fd_write(data: Uint8Array): { ret: number; nwritten: number } {
		const text = new TextDecoder().decode(data);
        console.log('WASI output:', text); // Debug output
		this.collectedOutput += text;
		return { ret: 0, nwritten: data.length };
	}

	getOutput(): string {
		return this.collectedOutput;
	}
}

export function escapePerlString(value: string): string {
	return value
		.replace(/\\/g, '\\\\')
		.replace(/"/g, '\\"')
		.replace(/\$/g, '\\$')
		.replace(/@/g, '\\@');
}

export interface PerlInputFile {
	name: string;
	data: Uint8Array;
}

export interface RunPerlResult {
	stdout: string;
	stderr: string;
    fs: Map<string, File>;
}

export async function runPerl(script: string, inputFiles: PerlInputFile[]): Promise<RunPerlResult> {
	const stdout = new CustomFd();
	const stderr = new CustomFd();

	const fs = new Map<string, File>(inputFiles.map((f) => [f.name, new File(f.data)]));

	const wasi = new WASI(
		['perl', '-e', script],
		['LC_ALL=C', 'PERL_UNICODE=SD'], // Added PERL_UNICODE for better string handling
		[
			new CustomFd(), // stdin (fd 0)
			stdout, // stdout (fd 1)
			stderr, // stderr (fd 2)
			new PreopenDirectory('/dev', new Map([['null', new File(new Uint8Array())]])),
			new PreopenDirectory('.', fs)
		],
		{ debug: false }
	);

    // Set up imports with memory configuration
	const imports = {
		wasi_snapshot_preview1: wasi.wasiImport,
		env: {
			memory: new WebAssembly.Memory({
				initial: 100, // Initial memory in pages (6.4MB)
				maximum: 1000, // Maximum memory in pages (64MB)
				shared: false
			})
		}
	};

	const wasmBuffer = await fetchZeroPerl();

	console.log('Loading WASM...');
	const { instance } = await instantiate(wasmBuffer, imports);
	console.log('WASM loaded successfully');

	try {
		wasi.start(instance as { exports: { memory: WebAssembly.Memory; _start: () => void } });
	} catch (e) {
		if (e instanceof WASIProcExit) {
			if (e.code !== 0) {
				throw new Error(`perl exited with code ${e.code}: ${stderr.getOutput()}`);
			}
		} else {
			throw e;
		}
	}

	return { stdout: stdout.getOutput(), stderr: stderr.getOutput(), fs };
}
