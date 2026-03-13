import { MessagingPanel } from "@/components/messages/messaging-panel";
import { createClient } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";
import { displayNameFromIdentity } from "@/lib/display-name";
import { getCurrentAppUser } from "@/services/auth-service";

const isMissingReadField = (code?: string) => code === "42703" || code === "PGRST204";

export default async function MessagesPage({ searchParams }: { searchParams?: { peer_id?: string; preset?: string } }) {
  const supabase = createClient();
  const currentUser = await getCurrentAppUser();
  const requestedPeerId = searchParams?.peer_id;

  const peersQuery =
    currentUser.role === "client"
      ? supabase.from("app_users").select("id,email,full_name,role,profile_photo_path").in("role", ["coach", "admin"])
      : supabase.from("app_users").select("id,email,full_name,role,profile_photo_path").neq("id", currentUser.id);

  const { data: peers, error: peersError } = await peersQuery;
  if (peersError) {
    throw peersError;
  }

  const photoPaths = Array.from(new Set((peers || []).map((p) => p.profile_photo_path).filter((p): p is string => Boolean(p))));
  const photoByPath = new Map<string, string>();
  if (photoPaths.length > 0) {
    try {
      const admin = createAdminClient();
      const { data: signedRows } = await admin.storage.from("profile-photos").createSignedUrls(photoPaths, 60 * 60);
      for (const row of signedRows || []) {
        if (row.path && row.signedUrl) photoByPath.set(row.path, row.signedUrl);
      }
    } catch {
      // fail open with initials if signing fails
    }
  }

  const normalizedPeers = (peers || []).map((peer) => ({
    ...peer,
    name: displayNameFromIdentity({ fullName: peer.full_name, email: peer.email, fallbackId: peer.id }),
    photo_url: peer.profile_photo_path ? photoByPath.get(peer.profile_photo_path) || null : null
  }));

  const selectedPeer =
    (requestedPeerId ? normalizedPeers.find((peer) => peer.id === requestedPeerId) : null) || normalizedPeers[0];

  const { data: initialMessages, error: messagesError } = selectedPeer
    ? await supabase
        .from("messages")
        .select("*")
        .or(`and(sender_id.eq.${currentUser.id},receiver_id.eq.${selectedPeer.id}),and(sender_id.eq.${selectedPeer.id},receiver_id.eq.${currentUser.id})`)
        .order("created_at", { ascending: false })
        .limit(150)
    : { data: [], error: null };

  if (messagesError) {
    throw messagesError;
  }

  const { data: unreadRows, error: unreadError } = await supabase
    .from("messages")
    .select("sender_id")
    .eq("receiver_id", currentUser.id)
    .is("read_at", null);

  if (unreadError && !isMissingReadField(unreadError.code)) {
    throw unreadError;
  }

  const unreadByPeer = ((unreadRows || []) as { sender_id: string }[]).reduce<Record<string, number>>((acc, row) => {
    acc[row.sender_id] = (acc[row.sender_id] || 0) + 1;
    return acc;
  }, {});

  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-bold">Messaging</h1>
      <MessagingPanel
        currentUserId={currentUser.id}
        peers={normalizedPeers}
        initialMessages={(initialMessages || []).slice().reverse()}
        initialSelectedPeerId={selectedPeer?.id || ""}
        initialPreset={searchParams?.preset || ""}
        canUseTemplates={currentUser.role === "coach" || currentUser.role === "admin"}
        initialUnreadByPeer={unreadByPeer}
      />
    </section>
  );
}
