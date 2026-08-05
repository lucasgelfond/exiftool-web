<script lang="ts">
    import type { ParsedOutput } from "$lib/types/parsed-output";
    import { removeMetadata } from '$lib/utils/remove-metadata';
    import { onDestroy } from 'svelte';

    export let fileUrl: string;
    export let currentFile: File | null;
    export let output: ParsedOutput;

    let container: HTMLDivElement;
    let searchTerm = '';
    let filteredOutput: ParsedOutput = [];

    let stripping = false;
    let stripError: string | null = null;
    let strippedFileName: string | null = null;
    let strippedUrl: string | null = null;

    function resetStrippedResult() {
        if (strippedUrl) {
            URL.revokeObjectURL(strippedUrl);
        }
        strippedUrl = null;
        strippedFileName = null;
        stripError = null;
    }

    $: if (currentFile) {
        // Reset scroll position when file changes
        if (container) {
            container.scrollTop = 0;
        }
        resetStrippedResult();
    }

    onDestroy(() => {
        if (strippedUrl) URL.revokeObjectURL(strippedUrl);
    });

    async function handleStripMetadata() {
        if (!currentFile) return;
        stripping = true;
        resetStrippedResult();
        try {
            const { blob, fileName } = await removeMetadata(currentFile);
            strippedUrl = URL.createObjectURL(blob);
            strippedFileName = fileName;
        } catch (error) {
            console.error('Error removing metadata:', error);
            stripError = 'Something went wrong removing metadata. Please try again.';
        } finally {
            stripping = false;
        }
    }

    $: {
        if (output?.length > 0) {
            if (searchTerm.trim() === '') {
                filteredOutput = output;
            } else {
                const term = searchTerm.toLowerCase();
                filteredOutput = output.filter(
                    item => item.label.toLowerCase().includes(term) || 
                           item.value.toLowerCase().includes(term)
                );
            }
        } else {
            filteredOutput = [];
        }
    }
</script>

<div bind:this={container} class="w-full md:w-[65%] flex flex-col gap-4 max-h-[300px] md:max-h-[600px] md:min-w-[550px] overflow-auto bg-gray-100 border border-gray-300 rounded px-5 pb-5 pt-2.5">
    <div class="flex flex-col md:flex-row md:items-center md:justify-between">
        <h2 class="text-lg md:text-2xl md:py-3 py-2 font-mono font-extrabold">Metadata</h2>
        {#if currentFile && output?.length > 0}
            <div class="hidden md:block">
                <input 
                    type="text" 
                    placeholder="Search metadata..." 
                    bind:value={searchTerm}
                    class="px-3 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
            </div>
        {/if}
    </div>
    {#if currentFile}
        <div class="w-full overflow-auto transition-all duration-300 ease-in-out opacity-0 {fileUrl ? 'opacity-100' : ''} min-h-[200px]">
            {#if output?.length > 0}
                <div class="flex flex-col gap-1 md:grid md:grid-cols-2 md:gap-2 font-mono text-xs lg:text-base md:text-base">
                    {#each filteredOutput as {label, value}}
                        <div class="font-semibold">{label}</div>
                        <div class="mb-2 md:mb-0">{value}</div>
                    {/each}
                </div>
                {#if filteredOutput.length === 0 && searchTerm.trim() !== ''}
                    <div class="flex justify-center items-center h-full text-gray-500 font-mono text-sm md:text-base">
                        No metadata matches your search
                    </div>
                {/if}
            {:else}
                <div class="flex justify-center items-center h-full text-gray-500 font-mono text-sm md:text-base">
                    exiftool could not properly be run on this file.
                </div>
            {/if}
        </div>

        <div class="border-t border-gray-300 pt-4 flex flex-col gap-2">
            <button
                class="self-start border-2 border-gray-300 rounded px-4 py-2 font-mono text-sm hover:border-blue-500 hover:bg-blue-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                on:click={handleStripMetadata}
                disabled={stripping}
            >
                {stripping ? 'Removing metadata…' : 'Strip metadata'}
            </button>

            {#if stripError}
                <p class="text-sm text-red-600 font-mono">{stripError}</p>
            {/if}

            {#if strippedUrl && strippedFileName}
                <a
                    href={strippedUrl}
                    download={strippedFileName}
                    class="self-start text-sm font-mono text-blue-600 underline"
                >
                    Download {strippedFileName}
                </a>
            {/if}
        </div>
    {:else}
        <div class="flex justify-center items-center h-[200px] text-gray-500 text-sm md:text-base">
            Preview will appear here
        </div>
    {/if}
</div>