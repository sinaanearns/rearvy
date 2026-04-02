"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Loader2, Users, User, TrendingUp, ArrowLeft } from "lucide-react";
import { useAuthContext } from "@/hooks/use-auth-context";
import { getIdToken } from "@/lib/firebase/auth";

interface Society {
  id: string;
  name: string;
  description: string | null;
  category: string;
  status: string;
  founder_id: string;
  member_count: number;
  total_revenue?: number;
}

interface Member {
  id: string;
  user_id: string;
  ownership_percent: number;
  role: string;
  status: string;
}

export default async function SocietyDetailPage({
  params,
}: {
  params: Promise<{ societyId: string }>;
}) {
  const { societyId } = await params;

  return <SocietyDetail societyId={societyId} />;
}

function SocietyDetail({ societyId }: { societyId: string }) {
  const [society, setSociety] = useState<Society | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const { user } = useAuthContext();

  useEffect(() => {
    if (loading) return;

    if (!user) {
      router.push("/login");
      return;
    }

    fetchSociety();
  }, [user, loading, societyId, router]);

  async function fetchSociety() {
    try {
      setLoading(true);
      const token = await getIdToken();
      if (!token) {
        throw new Error("Missing auth token. Please sign in again.");
      }

      const [societyRes, membersRes] = await Promise.all([
        fetch(`/api/societies/${societyId}`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`/api/societies/${societyId}/members`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      if (!societyRes.ok) {
        throw new Error("Failed to load society");
      }

      const societyData = await societyRes.json();
      setSociety(societyData);

      if (membersRes.ok) {
        const membersData = await membersRes.json();
        setMembers(membersData.members || []);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !society) {
    return (
      <div className="max-w-2xl mx-auto">
        <Link href="/society" className="inline-flex items-center text-sm mb-6">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Societies
        </Link>
        <Card className="border-red-200 bg-red-50">
          <CardHeader>
            <CardTitle className="text-red-900">Error</CardTitle>
          </CardHeader>
          <CardContent className="text-red-800">
            {error || "Society not found"}
          </CardContent>
        </Card>
      </div>
    );
  }

  const isFounder = user?.uid === society.founder_id;

  return (
    <div className="space-y-6">
      {/* Back Button */}
      <Link href="/society" className="inline-flex items-center text-sm">
        <ArrowLeft className="w-4 h-4 mr-2" />
        Back to Societies
      </Link>

      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">{society.name}</h1>
        {society.description && (
          <p className="text-muted-foreground">{society.description}</p>
        )}
        <div className="flex items-center gap-2 text-sm">
          <span className="px-2 py-1 rounded-full bg-secondary capitalize">
            {society.category}
          </span>
          <span className="px-2 py-1 rounded-full bg-blue-100 text-blue-800 capitalize">
            {society.status}
          </span>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Members</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold flex items-center">
              <Users className="w-5 h-5 mr-2 text-blue-500" />
              {society.member_count}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold flex items-center">
              <TrendingUp className="w-5 h-5 mr-2 text-green-500" />
              ${(society.total_revenue || 0).toLocaleString()}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Your Role</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold flex items-center capitalize">
              <User className="w-5 h-5 mr-2 text-purple-500" />
              {isFounder ? "Founder" : "Member"}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="members">Members</TabsTrigger>
          <TabsTrigger value="contributions">Contributions</TabsTrigger>
          <TabsTrigger value="financials">Financials</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Ownership Structure</CardTitle>
              <CardDescription>
                How ownership is distributed among members
              </CardDescription>
            </CardHeader>
            <CardContent>
              {members.length > 0 ? (
                <div className="space-y-3">
                  {members
                    .filter((m) => m.status === "active")
                    .map((member) => (
                      <div
                        key={member.id}
                        className="flex items-center justify-between"
                      >
                        <span className="text-sm capitalize">{member.role}</span>
                        <div className="flex-1 mx-4 bg-secondary rounded-full h-2">
                          <div
                            className="bg-blue-500 h-2 rounded-full"
                            style={{
                              width: `${member.ownership_percent}%`,
                            }}
                          />
                        </div>
                        <span className="text-sm font-semibold">
                          {member.ownership_percent.toFixed(1)}%
                        </span>
                      </div>
                    ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No active members yet
                </p>
              )}
            </CardContent>
          </Card>

          {isFounder && (
            <Card>
              <CardHeader>
                <CardTitle>Founder Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Link
                  href={`/society/${society.id}/members`}
                  className="block"
                >
                  <Button variant="outline" className="w-full justify-start">
                    Manage Members & Invites
                  </Button>
                </Link>
                <Link
                  href={`/society/${society.id}/contributions`}
                  className="block"
                >
                  <Button variant="outline" className="w-full justify-start">
                    Review Contributions
                  </Button>
                </Link>
                <Link
                  href={`/society/${society.id}/financials`}
                  className="block"
                >
                  <Button variant="outline" className="w-full justify-start">
                    Distribute Revenue
                  </Button>
                </Link>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Members Tab */}
        <TabsContent value="members">
          <Card>
            <CardHeader>
              <CardTitle>Members</CardTitle>
              <CardDescription>All members and their details</CardDescription>
            </CardHeader>
            <CardContent>
              {members.length > 0 ? (
                <div className="space-y-4">
                  {members.map((member) => (
                    <div
                      key={member.id}
                      className="flex items-center justify-between p-3 border rounded-lg"
                    >
                      <div>
                        <p className="font-semibold capitalize">{member.role}</p>
                        <p className="text-sm text-muted-foreground">
                          {member.ownership_percent.toFixed(1)}% ownership
                        </p>
                      </div>
                      <span className="inline-block px-2 py-1 text-xs rounded capitalize bg-secondary">
                        {member.status}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No members found</p>
              )}

              {isFounder && (
                <Button className="w-full mt-4" variant="outline">
                  + Invite Member
                </Button>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Contributions Tab */}
        <TabsContent value="contributions">
          <Card>
            <CardHeader>
              <CardTitle>Contributions</CardTitle>
              <CardDescription>Track work and hours contributed</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                No contributions yet. Members can start logging their work.
              </p>
              <Button className="w-full mt-4" variant="outline">
                + Log Contribution
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Financials Tab */}
        <TabsContent value="financials">
          <Card>
            <CardHeader>
              <CardTitle>Financials</CardTitle>
              <CardDescription>Revenue and distribution history</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                No transactions yet. {isFounder && "You can start logging revenue and distributing it to members."}
              </p>
              {isFounder && (
                <Button className="w-full mt-4" variant="outline">
                  + Log Transaction
                </Button>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
