/**
 * "Save as PDF" via the browser's own print pipeline.
 *
 * Deliberately not a PDF library. jsPDF and pdfmake would add roughly 200KB
 * to the bundle and lay text out as positioned boxes, which loses selectable
 * text and real hyphenation; server-side rendering would put a headless
 * browser on a free instance. The print stylesheet in print.css produces
 * better typography than either, costs nothing, and the output is a real
 * text PDF the reader can search.
 *
 * The one thing worth scripting: browsers name the saved file after
 * document.title, so a plan saved from here should not be called
 * "Groundwork" like every other page.
 */

function toFilename(title) {
  const slug = String(title)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
  const date = new Date().toISOString().slice(0, 10)
  return `groundwork-${slug || 'plan'}-${date}`
}

export function downloadPlanAsPdf(title) {
  const previous = document.title
  document.title = toFilename(title)

  // Restore on the next tick rather than immediately after print(): Safari
  // and Firefox read the title asynchronously, and resetting too early
  // leaves the file named after whatever the tab said before.
  const restore = () => {
    document.title = previous
    window.removeEventListener('afterprint', restore)
  }
  window.addEventListener('afterprint', restore)
  setTimeout(restore, 3000)

  window.print()
}
