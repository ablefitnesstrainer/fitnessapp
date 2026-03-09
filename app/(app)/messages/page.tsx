import { MessagingPanel } from "@/components/messages/messaging-panel";
import { createClient } from "@/lib/supabase-server";
import { displayNameFromIdentity } from "@/lib/display-name";
import { getCurrentAppUser } from "@/services/auth-service";

export default async function MessagesPage({ searchParams }: { searchParams?: { peer_id?: string; preset?: string } }) {
  const supabase = createClient();
  const currentUser = await getCurrentAppUser();
  const requestedPeerId = searchParams?.peer_id;

  const peersQuery =
    currentUser.role === "client"
      ? supabase.from("app_users").select("id,email,full_name,role").in("role", ["coach", "admin"])
      : supabase.from("app_users").select("id,email,full_name,role").neq("id", currentUser.id);

  const { data: peers, error: peersError } = await peersQuery;
  if (peersError) {
    throw peersError;
  }

  const normalizedPeers = (peers || []).map((peer) => ({
    ...peer,
    name: displayNameFromIdentity({ fullName: peer.full_name, email: peer.email, fallbackId: peer.id })
  }));

  const selectedPeer =
    (requestedPeerId ? normalizedPeers.find((peer) => peer.id === requestedPeerId) : null) || normalizedPeers[0];

  const { data: initialMessages, error: messagesError } = selectedPeer
    ? await supabase
        .from("messages")
        .select("*")
        .or(`and(sender_id.eq.${currentUser.id},receiver_id.eq.${selectedPeer.id}),and(sender_id.eq.${selectedPeer.id},receiver_id.eq.${currentUser.id})`)
        .order("created_at", { ascending: true })
    : { data: [], error: null };

  if (messagesError) {
    throw messagesError;
  }

  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-bold">Messaging</h1>
      <MessagingPanel
        currentUserId={currentUser.id}
        peers={normalizedPeers}
        initialMessages={initialMessages || []}
        initialSelectedPeerId={selectedPeer?.id || ""}
        initialPreset={searchParams?.preset || ""}
        canUseTemplates={currentUser.role === "coach" || currentUser.role === "admin"}
      />
    </section>
  );
}
