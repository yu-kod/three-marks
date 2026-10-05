import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

export default function NotFoundPage() {
  return (
    <main className="mx-auto flex min-h-svh max-w-xl flex-col justify-center gap-4 px-4">
      <h1 className="text-3xl font-bold">ページが見つからない</h1>
      <Button asChild className="self-start">
        <Link to="/">トップへ戻る</Link>
      </Button>
    </main>
  );
}
