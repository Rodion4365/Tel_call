import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ChevronRight } from "lucide-react";
import { getTelegramUser } from "../services/telegram";
import MobileFrame from "../components/MobileFrame";
import TopBar from "../components/TopBar";
import Switch from "../components/ui/Switch";
import { cn } from "../lib/utils";

const MICROPHONE_STORAGE_KEY = "tel-call:microphone-enabled";

const SectionLabel = ({ children }: { children: React.ReactNode }) => (
  <div className="text-xs font-semibold tracking-widest text-zinc-500 uppercase mb-2 px-1">
    {children}
  </div>
);

const Card = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <div className={cn(
    "bg-zinc-900/60 border border-zinc-800/60 rounded-2xl overflow-hidden p-5",
    className
  )}>
    {children}
  </div>
);

const CardTitle = ({ children }: { children: React.ReactNode }) => (
  <h3 className="text-xl font-semibold text-white mb-4">{children}</h3>
);

const SettingsPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const telegramUser = useMemo(() => getTelegramUser(), []);
  const [isMicrophoneEnabled, setIsMicrophoneEnabled] = useState(true);

  useEffect(() => {
    const storedValue = localStorage.getItem(MICROPHONE_STORAGE_KEY);

    if (storedValue !== null) {
      setIsMicrophoneEnabled(storedValue === "true");
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(MICROPHONE_STORAGE_KEY, String(isMicrophoneEnabled));
  }, [isMicrophoneEnabled]);

  const changeLanguage = (lng: string) => {
    i18n.changeLanguage(lng);
  };

  return (
    <MobileFrame>
      <div className="h-full w-full bg-gradient-to-b from-[#0f111a] to-black text-white font-sans overflow-y-auto pb-20">
        <TopBar showBack={true} backTo="/" />
        <div className="px-5 pt-2 max-w-md mx-auto space-y-6">
          <div>
            <div className="text-xs font-semibold tracking-widest text-zinc-500 uppercase mb-1">
              {t("settingsPage.title")}
            </div>
            <h1 className="text-2xl font-bold text-white">
              {t("settingsPage.subtitle")}
            </h1>
          </div>

          {/* Language Card */}
          <div>
            <SectionLabel>{t("settingsPage.language")}</SectionLabel>
            <Card>
              <CardTitle>{t("settingsPage.language")}</CardTitle>
              <div className="flex gap-3 mt-4">
                <button
                  className={cn(
                    "flex-1 py-2.5 px-4 rounded-xl font-medium text-sm transition-colors border",
                    i18n.language === "ru"
                      ? "bg-zinc-800 text-white border-zinc-700"
                      : "bg-transparent text-zinc-400 hover:bg-zinc-800/50 hover:text-white border-zinc-800"
                  )}
                  onClick={() => changeLanguage("ru")}
                >
                  {t("settingsPage.languageRu")}
                </button>
                <button
                  className={cn(
                    "flex-1 py-2.5 px-4 rounded-xl font-medium text-sm transition-colors border",
                    i18n.language === "en"
                      ? "bg-zinc-800 text-white border-zinc-700"
                      : "bg-transparent text-zinc-400 hover:bg-zinc-800/50 hover:text-white border-zinc-800"
                  )}
                  onClick={() => changeLanguage("en")}
                >
                  {t("settingsPage.languageEn")}
                </button>
              </div>
            </Card>
          </div>

          {/* Profile Card */}
          <div>
            <SectionLabel>{t("settingsPage.profileSection")}</SectionLabel>
            <Card className="space-y-4">
              <CardTitle>{t("settingsPage.profileTitle")}</CardTitle>

              <div className="flex justify-between items-center py-1">
                <span className="text-zinc-400 font-medium">{t("settingsPage.firstName")}</span>
                <span className="text-white font-medium">{telegramUser?.first_name ?? "—"}</span>
              </div>
              <div className="w-full h-px bg-zinc-800/50" />
              <div className="flex justify-between items-center py-1">
                <span className="text-zinc-400 font-medium">{t("settingsPage.username")}</span>
                <span className="text-[#8B78E6] font-medium">
                  {telegramUser?.username ? `@${telegramUser.username}` : "—"}
                </span>
              </div>
            </Card>
          </div>

          {/* Call Settings Card */}
          <div>
            <SectionLabel>{t("settingsPage.defaultsSection")}</SectionLabel>
            <Card>
              <CardTitle>{t("settingsPage.defaultsTitle")}</CardTitle>

              <div className="flex justify-between items-center mt-6">
                <div className="space-y-1">
                  <div className="text-white font-medium text-[17px]">{t("settingsPage.microphone")}</div>
                  <div className="text-zinc-500 text-sm">{t("settingsPage.microphoneDefault")}</div>
                </div>
                <Switch
                  checked={isMicrophoneEnabled}
                  onCheckedChange={setIsMicrophoneEnabled}
                  className="data-[state=checked]:bg-[#7C66DC]"
                />
              </div>
            </Card>
          </div>

          {/* Security Card */}
          <div>
            <SectionLabel>{t("settingsPage.securitySection")}</SectionLabel>
            <Card>
              <CardTitle>{t("settingsPage.securityTitle")}</CardTitle>
              <p className="text-zinc-500 text-[15px] leading-relaxed">
                {t("settingsPage.securityDescription")}
              </p>
            </Card>
          </div>

          {/* User Agreement Card */}
          <div className="pb-6">
            <Link to="/terms">
              <div className="cursor-pointer">
                <SectionLabel>{t("settingsPage.informationSection", "Информация")}</SectionLabel>
                <Card className="active:bg-zinc-800/60 transition-colors group flex justify-between items-center py-6">
                  <span className="text-white font-semibold text-lg">
                    {t("settingsPage.userAgreement", "Пользовательское соглашение")}
                  </span>
                  <ChevronRight className="w-6 h-6 text-zinc-600 group-hover:text-white transition-colors" />
                </Card>
              </div>
            </Link>
          </div>
        </div>
      </div>
    </MobileFrame>
  );
};

export default SettingsPage;
