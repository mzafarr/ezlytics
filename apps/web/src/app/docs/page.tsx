export default function QuickstartPage() {
  return (
    <div>
      <h1>Introduction &amp; Quickstart</h1>
      <p className="text-lg text-muted-foreground">
        Welcome to the documentation! Learn how to integrate our lightweight,
        privacy-first analytics into your Next.js or React application.
      </p>

      <hr className="my-8 border-foreground/20" />

      <h2>What is this?</h2>
      <p>
        A ridiculously simple web analytics tool designed to capture pageviews,
        custom events, and revenue without compromising user privacy. It is
        built with performance in mind (our script is tiny—around ~6kb gzipped)
        and is designed to be integrated in less than 3 minutes.
      </p>

      <h2>Getting Started</h2>
      <ol>
        <li>
          <strong>Create a Project:</strong> Head over to your dashboard and
          click "Create Project". Enter your website URL and a friendly name.
        </li>
        <li>
          <strong>Get your Project ID:</strong> Once created, you will be given
          a unique Project ID and a snippet of code.
        </li>
        <li>
          <strong>Install the Script:</strong> Copy your snippet (it includes
          your Website ID, Domain, and API Key) and add it to your codebase
          using the HTML or React/Next.js guides below.
        </li>
      </ol>

      <div className="bg-amber-100 dark:bg-amber-900/30 border-2 border-foreground p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] my-8">
        <h4 className="font-bold flex items-center gap-2 m-0 text-amber-900 dark:text-amber-200">
          <span className="text-xl">💡</span> Pro Tip
        </h4>
        <p className="m-0 mt-2 text-amber-800 dark:text-amber-100">
          Your snippet requires three attributes: <code>data-website-id</code>,{" "}
          <code>data-domain</code>, and <code>data-api-key</code>. All three are
          required — the script silently stops if any are missing. Copy the full
          snippet from your dashboard to avoid any issues.
        </p>
      </div>

      <h2>Next Steps</h2>
      <p>
        Once you have your Project ID, check out our integration guides to get
        events flowing:
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 not-prose">
        <a
          href="/docs/html"
          className="flex flex-col p-4 border-2 border-foreground bg-background hover:bg-muted shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all rounded-md"
        >
          <h3 className="font-bold text-lg mb-1">Vanilla HTML</h3>
          <p className="text-sm text-muted-foreground m-0">
            Use a standard `&lt;script&gt;` tag for static sites or simple HTML.
          </p>
        </a>
        <a
          href="/docs/react"
          className="flex flex-col p-4 border-2 border-foreground bg-background hover:bg-muted shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all rounded-md"
        >
          <h3 className="font-bold text-lg mb-1">React / Next.js</h3>
          <p className="text-sm text-muted-foreground m-0">
            Using the npm package directly in modern React applications.
          </p>
        </a>
      </div>
    </div>
  );
}
