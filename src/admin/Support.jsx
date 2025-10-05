import React from "react";

const Container = ({ children }) => <div className="mx-auto w-full max-w-screen-2xl p-4">{children}</div>;

const Card = ({ children, title, subtitle }) => (
  <div className="rounded-2xl border bg-white p-6 shadow-sm">
    {title && <h1 className="text-xl font-semibold">{title}</h1>}
    {subtitle && <p className="mt-1 text-sm text-zinc-600">{subtitle}</p>}
    <div className="mt-4">{children}</div>
  </div>
);

export default function Support() {
  return (
    <Container>
      <Card title="Support" subtitle="Thanks for trying ASAPro!">
        <div className="space-y-4 text-sm text-zinc-700 leading-6">
          <p>
            ASAPro is an active work-in-progress built by a solo developer as a passion project. 
            Features are evolving rapidly—expect rough edges while we shape this into a tool that
            genuinely helps independent shops run smoother.
          </p>

          <div className="rounded-xl border bg-zinc-50 p-4">
            <div className="font-semibold">Need help?</div>
            <p>
              Email:{" "}
              <a className="underline" href="mailto:dgrayzanic.jr@gmail.com">
                dgrayzanic.jr@gmail.com
              </a>
            </p>
          </div>

          <div className="rounded-xl border bg-zinc-50 p-4">
            <div className="font-semibold">Support development</div>
            <p>
              If this project saves you time and you’d like to keep it moving, donations are appreciated:
              <br />
              Venmo: <span className="font-mono">@DavefromTPF</span>
            </p>
          </div>

          <p className="text-xs text-zinc-500">
            Disclaimer: ASAPro is provided “as is” during active development. Please keep backups of critical data.
          </p>
        </div>
      </Card>
    </Container>
  );
}
