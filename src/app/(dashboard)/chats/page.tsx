import { MessagesSquare, Clock } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { createClient, getUser } from "@/lib/supabase/server";
import { formatDistanceToNow } from "date-fns";
import { redirect } from "next/navigation";

export default async function ChatsPage() {
    const { data: { user } } = await getUser();

    if (!user) {
        redirect("/login");
    }

    const supabase = await createClient();

    const { data: chats } = await supabase
        .from("chats")
        .select("id, title, updated_at")
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false });

    // Add robust type-checking for formatting
    const formattedChats = (chats || []).map(chat => ({
        ...chat,
        dateValue: chat.updated_at ? new Date(chat.updated_at) : new Date()
    }));

    return (
        <div className="mx-auto max-w-4xl space-y-6 px-4 md:px-0">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold md:text-3xl">Chats</h1>
                    <p className="mt-1 text-sm text-muted-foreground">
                        View and manage your conversation history
                    </p>
                </div>
            </div>

            {formattedChats.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-32 text-center bg-card/50">
                    <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 mb-4">
                        <MessagesSquare className="h-8 w-8 text-primary" />
                    </div>
                    <h3 className="font-semibold text-lg">No history yet</h3>
                    <p className="mt-2 text-sm text-muted-foreground max-w-sm">
                        Start a conversation with Rearvy to see your chat history here.
                    </p>
                    <Link href="/chat/new" className="mt-6">
                        <Button variant="default">
                            Start your first chat
                        </Button>
                    </Link>
                </div>
            ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {formattedChats.map((chat) => (
                        <Link
                            key={chat.id}
                            href={`/chat/${chat.id}`}
                            className="group flex flex-col justify-between rounded-xl border bg-card p-5 transition-all hover:border-primary/50 hover:shadow-md hover:shadow-primary/5"
                        >
                            <div>
                                <div className="mb-3 flex items-start justify-between">
                                    <div className="rounded-lg bg-primary/10 p-2">
                                        <MessagesSquare className="h-4 w-4 text-primary" />
                                    </div>
                                </div>
                                <h3 className="font-medium leading-tight line-clamp-2 title-font">
                                    {chat.title || "New Chat"}
                                </h3>
                            </div>
                            <div className="mt-6 flex items-center text-xs text-muted-foreground">
                                <Clock className="mr-1.5 h-3.5 w-3.5" />
                                {formatDistanceToNow(chat.dateValue, { addSuffix: true })}
                            </div>
                        </Link>
                    ))}
                </div>
            )}
        </div>
    );
}
