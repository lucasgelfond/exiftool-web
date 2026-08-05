import { runPerl, escapePerlString } from './run-perl';
import { parseExifOutput } from './parse-exif-output';
import type { ParsedOutput } from '$lib/types/parsed-output';

async function runExifTools(browserFile: globalThis.File): Promise<ParsedOutput> {
	try {
		const fileName = browserFile.name;
		const imageData = await browserFile.arrayBuffer();
		const escapedFileName = escapePerlString(fileName)

		const perlScript = `
        use Image::ExifTool;
        my $exif = Image::ExifTool->new();

        $exif->Options(Unknown => 1);  # Show unknown tags

        my $info = $exif->ImageInfo("${escapedFileName}");
        if ($exif->GetValue("Error")) {
            print "Error: " . $exif->GetValue("Error") . "\\n";
        } else {
            foreach my $tag (sort keys %$info) {
                my $val = $info->{$tag};
                print "$tag: $val\\n";
            }
        }
        `;

		const { stdout } = await runPerl(perlScript, [
			{ name: fileName, data: new Uint8Array(imageData) }
		]);

		return parseExifOutput(stdout)
	} catch (error) {
		console.error('Error running ExifTool:', error);
		throw new Error('Failed to run ExifTool', { cause: error });
	}
}

export { runExifTools };
