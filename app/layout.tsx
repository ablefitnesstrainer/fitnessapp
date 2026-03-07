import "./globals.css";

export const metadata = {
  title: "Able Fitness Coaching App",
  description: "Fitness coaching platform"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
