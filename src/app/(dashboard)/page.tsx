import Link from "next/link";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { MessageSquare, FolderKanban, Plug } from "lucide-react";

export default function DashboardPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Welcome to Rearvy</h1>
        <p className="text-muted-foreground">
          Your AI-powered business assistant. Get started below.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Link href="/chat">
          <Card className="cursor-pointer transition-colors hover:bg-accent/50">
            <CardHeader>
              <MessageSquare className="mb-2 h-8 w-8 text-primary" />
              <CardTitle className="text-base">Start chatting</CardTitle>
              <CardDescription>
                Ask questions about your business
              </CardDescription>
            </CardHeader>
          </Card>
        </Link>
        <Link href="/projects">
          <Card className="cursor-pointer transition-colors hover:bg-accent/50">
            <CardHeader>
              <FolderKanban className="mb-2 h-8 w-8 text-primary" />
              <CardTitle className="text-base">Create a project</CardTitle>
              <CardDescription>
                Organize chats by campaign or goal
              </CardDescription>
            </CardHeader>
          </Card>
        </Link>
        <Link href="/integrations">
          <Card className="cursor-pointer transition-colors hover:bg-accent/50">
            <CardHeader>
              <Plug className="mb-2 h-8 w-8 text-primary" />
              <CardTitle className="text-base">Connect data</CardTitle>
              <CardDescription>
                Link Shopify, Instagram, YouTube
              </CardDescription>
            </CardHeader>
          </Card>
        </Link>
      </div>
    </div>
  );
}
