import { runPerl, escapePerlString } from './run-perl';

export interface RemoveMetadataResult {
	blob: Blob;
	fileName: string;
}

async function removeMetadata(browserFile: globalThis.File): Promise<RemoveMetadataResult> {
	try {
		const fileName = browserFile.name;
		const imageData = await browserFile.arrayBuffer();
        const outputFileName = `stripped-${fileName}`;
		const escapedFileName = escapePerlString(fileName);
		const escapedOutputFileName = escapePerlString(outputFileName);

		const perlScript = `
        use Image::ExifTool;
        my $exifTool = Image::ExifTool->new();

        $exifTool->SetNewValue('*');

        my $ok = $exifTool->WriteInfo("${escapedFileName}", "${escapedOutputFileName}");
        if ($ok) {
            print "OK\\n";
        } else {
            print "Error: " . $exifTool->GetValue("Error") . "\\n";
        }
        `;

		const { stdout, stderr, fs } = await runPerl(perlScript, [
			{ name: fileName, data: new Uint8Array(imageData) }
		]);

		if (!stdout.includes('OK')) {
			throw new Error(`Failed to strip metadata: ${stdout}${stderr}`);
		}

		const outputFile = fs.get(outputFileName);
		if (!outputFile) {
			throw new Error(`Expected output file "${outputFileName}" was not produced`);
		}

		return {
			blob: new Blob([outputFile.data], { type: browserFile.type || 'application/octet-stream' }),
			fileName: outputFileName
		};
	} catch (error) {
		console.error('Error removing metadata:', error);
		throw new Error('Failed to remove metadata', { cause: error });
	}
}

export { removeMetadata };
