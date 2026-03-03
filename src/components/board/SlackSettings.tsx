"use client";

import { useState, useEffect } from "react";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";

interface SlackChannel {
  id: string;
  name: string;
  isPrivate: boolean;
}

interface SlackSettingsProps {
  boardId: string;
  slackConnected: boolean;
  slackChannelId: string | null;
  slackChannelName: string | null;
  slackTeamName: string | null;
  onClose: () => void;
  onUpdate: () => void;
}

export default function SlackSettings({
  boardId,
  slackConnected,
  slackChannelId,
  slackChannelName,
  slackTeamName,
  onClose,
  onUpdate,
}: SlackSettingsProps) {
  const [channels, setChannels] = useState<SlackChannel[]>([]);
  const [loadingChannels, setLoadingChannels] = useState(false);
  const [selectedChannel, setSelectedChannel] = useState(slackChannelId || "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (slackConnected) {
      loadChannels();
    }
  }, [slackConnected]);

  const loadChannels = async () => {
    setLoadingChannels(true);
    try {
      const res = await fetch(`/api/slack/channels?boardId=${boardId}`);
      if (res.ok) {
        const data = await res.json();
        setChannels(data);
      }
    } catch { /* ignore */ } finally {
      setLoadingChannels(false);
    }
  };

  const connectSlack = () => {
    window.location.href = `/api/slack/install?boardId=${boardId}`;
  };

  const saveChannel = async () => {
    if (!selectedChannel) return;
    setSaving(true);
    try {
      const channel = channels.find((c) => c.id === selectedChannel);
      await fetch("/api/slack/channels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          boardId,
          channelId: selectedChannel,
          channelName: channel?.name || "",
        }),
      });
      onUpdate();
      onClose();
    } catch { /* ignore */ } finally {
      setSaving(false);
    }
  };

  const disconnectSlack = async () => {
    if (!confirm("Slack bağlantısını kaldırmak istediğinize emin misiniz?")) return;
    try {
      await fetch("/api/slack/disconnect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ boardId }),
      });
      onUpdate();
      onClose();
    } catch { /* ignore */ }
  };

  return (
    <Modal isOpen onClose={onClose} title="Slack Ayarları">
      <div className="space-y-4">
        {!slackConnected ? (
          // Slack'e bağlı değil
          <div className="text-center py-6">
            <div className="w-16 h-16 mx-auto mb-4 bg-purple-100 dark:bg-purple-900/30 rounded-2xl flex items-center justify-center">
              <svg className="w-8 h-8 text-purple-600 dark:text-purple-400" viewBox="0 0 24 24" fill="currentColor">
                <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zM15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-2">Slack&apos;e Bağlan</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              Board bildirimlerini Slack kanalınıza gönderin.
              <br />
              Kart oluşturma, yorum, taşıma gibi olaylar Slack&apos;e iletilir.
            </p>
            <Button onClick={connectSlack}>Slack ile Bağlan</Button>
          </div>
        ) : (
          // Slack'e bağlı
          <div>
            <div className="flex items-center gap-2 mb-4 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
              <div className="w-2 h-2 bg-green-500 rounded-full" />
              <span className="text-sm text-green-700 dark:text-green-400 font-medium">
                Slack bağlı{slackTeamName ? ` — ${slackTeamName}` : ""}
              </span>
            </div>

            {slackChannelId && slackChannelName && (
              <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <p className="text-sm text-blue-700 dark:text-blue-400">
                  Bildirimler <strong>#{slackChannelName}</strong> kanalına gönderiliyor
                </p>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Bildirim Kanalı Seçin
              </label>
              {loadingChannels ? (
                <p className="text-sm text-gray-400">Kanallar yükleniyor...</p>
              ) : (
                <select
                  value={selectedChannel}
                  onChange={(e) => setSelectedChannel(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Kanal seçin...</option>
                  {channels.map((ch) => (
                    <option key={ch.id} value={ch.id}>
                      {ch.isPrivate ? "🔒 " : "# "}{ch.name}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div className="flex justify-between mt-6">
              <button
                onClick={disconnectSlack}
                className="text-sm text-red-500 hover:text-red-700 dark:hover:text-red-400 transition"
              >
                Bağlantıyı Kes
              </button>
              <div className="flex gap-2">
                <Button variant="secondary" onClick={onClose}>Kapat</Button>
                <Button onClick={saveChannel} disabled={!selectedChannel || saving}>
                  {saving ? "Kaydediliyor..." : "Kaydet"}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
