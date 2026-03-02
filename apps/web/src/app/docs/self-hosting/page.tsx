import { CodeBlock } from "@/components/docs/code-block";

export default function SelfHostingPage() {
  return (
    <div>
      <h1>Self-Hosting</h1>
      <p className="text-lg text-muted-foreground">
        Ezlytics is completely open-source and ridiculously simple to deploy on
        your own infrastructure.
      </p>

      <hr className="my-8 border-foreground/20" />

      <h2>Prerequisites</h2>
      <ul>
        <li>
          <strong>Bun:</strong> Make sure you have{" "}
          <a href="https://bun.sh">Bun</a> installed.
        </li>
        <li>
          <strong>PostgreSQL:</strong> Any Postgres database (Neon, Supabase,
          local, etc.).
        </li>
      </ul>

      <h2>Step 1: Clone & Install</h2>
      <p>
        Clone the repository and install all dependencies using Bun. The project
        is built as a modern monorepo using Turborepo.
      </p>

      <CodeBlock
        language="bash"
        code={`git clone https://github.com/mzafarr/ezlytics.git
cd ezlytics
bun install`}
      />

      <h2>Step 2: Environment Variables</h2>
      <p>
        Copy the example environment variables file and fill in your database
        credentials and preferred auth setup.
      </p>

      <CodeBlock language="bash" code={`cp .env.example .env`} />

      <p>Ensure you at least define your database connection string:</p>
      <CodeBlock
        language="bash"
        code={`DATABASE_URL="postgres://user:password@localhost:5432/ezlytics"`}
      />

      <h2>Step 3: Database Migration</h2>
      <p>
        Push the database schema to your Postgres instance. We use Drizzle ORM
        under the hood.
      </p>

      <CodeBlock language="bash" code={`bun run db:push`} />

      <h2>Step 4: Start the Server</h2>
      <p>
        That's it! You can start the development server to verify everything
        works:
      </p>

      <CodeBlock language="bash" code={`bun run dev`} />

      <p>
        Your fully functional Ezlytics platform will be available at{" "}
        <strong>http://localhost:3000</strong> (or 3001 depending on your
        workspace setup).
      </p>

      <h2>Deploying to Production</h2>
      <p>
        Because Ezlytics is a standard Next.js application, you can deploy it
        absolutely anywhere Next.js runs:
      </p>
      <ul>
        <li>
          <strong>Docker / VPS:</strong> Build the Next.js standalone app and
          serve it directly, or use tools like Coolify.
        </li>
      </ul>

      <div className="bg-emerald-100 dark:bg-emerald-900/30 border-2 border-foreground p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] my-8">
        <h4 className="font-bold flex items-center gap-2 m-0 text-emerald-900 dark:text-emerald-200">
          <span className="text-xl">🚀</span> That's Really It!
        </h4>
        <p className="m-0 mt-2 text-emerald-800 dark:text-emerald-100">
          We built this to be completely self-contained. No complex queues,
          Redis cache servers, or external microservices are required. One
          Postgres DB and one Next.js app.
        </p>
      </div>
    </div>
  );
}
