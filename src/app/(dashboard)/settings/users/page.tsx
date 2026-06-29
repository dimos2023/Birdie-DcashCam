import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { ROLE_LABELS } from "@/lib/constants";
import { format } from "date-fns";

export const metadata = { title: "Users" };

export default async function UsersSettingsPage() {
  const supabase = await createClient();
  const { data: users } = await supabase
    .from("profiles")
    .select("*")
    .order("created_at", { ascending: false });

  return (
    <>
      <PageHeader
        title="Users"
        description="Manage organization users and role-based access"
      />
      <div className="space-y-6 p-6">
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="text-[#1C3664]">Team Members</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Joined</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users?.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">{user.full_name}</TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{ROLE_LABELS[user.role]}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={user.is_active ? "default" : "secondary"}>
                        {user.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {format(new Date(user.created_at), "dd MMM yyyy")}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="text-[#1C3664]">Role Permissions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2">
              {[
                { role: "Super Admin", perms: "Full system access, all organizations" },
                { role: "Org Admin", perms: "Manage users, settings, and all fleet data" },
                { role: "Operator", perms: "Manage customers, vehicles, devices, live monitoring" },
                { role: "Viewer", perms: "Read-only access to dashboard and live views" },
              ].map((item) => (
                <div key={item.role} className="rounded-lg border p-4">
                  <p className="font-medium text-[#1C3664]">{item.role}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{item.perms}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
