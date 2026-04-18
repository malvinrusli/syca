import { InviteForm } from "./invite-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function InvitesAdminPage() {
  return (
    <div className="mx-auto max-w-xl px-8 py-8">
      <h1 className="mb-6 text-xl font-semibold">Invite members</h1>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">New invite</CardTitle>
          <CardDescription>
            Invited people receive an email with a link. They set a password on first sign-in, then use it from then on.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <InviteForm />
        </CardContent>
      </Card>
    </div>
  );
}
