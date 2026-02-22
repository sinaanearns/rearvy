import { MessageSquare, Plus } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function ChatPage() {
  return (
    <div className="mx-auto flex max-w-3xl flex-col items-center justify-center py-20 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
        <MessageSquare className="h-8 w-8 text-primary" />
      </div>
      <h2 className="mt-4 text-xl font-semibold">Start a conversation</h2>
      <p className="mt-2 max-w-sm text-muted-foreground">
        Ask Rearvy about your revenue, products, customers, or content
        performance. It will fetch your real data to answer.
      </p>
      <Link href="/chat/new" className="mt-6">
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          New chat
        </Button>
      </Link>
    </div>
  );
}
