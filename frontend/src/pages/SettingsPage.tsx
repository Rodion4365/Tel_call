import React, { useMemo } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ChevronRight } from "lucide-react";
import { getTelegramUser } from "../services/telegram";
import MobileFrame from "../components/MobileFrame";
import TopBar from "../components/TopBar";
import { cn } from "../lib/utils";

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

  const changeLanguage = (lng: string) => {
    i18n.changeLanguage(lng);
  };

  return (
    <MobileFrame>
      <div className="relative flex h-full flex-col justify-start text-white pt-5 overflow-y-auto pb-20">
        <TopBar showBack={false} backTo="/" />
        <div className="px-5 pt-2 max-w-md mx-auto space-y-6">
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
                      ? "bg-[#7C66DC] text-white border-[#7C66DC]"
                      : "bg-zinc-900/50 text-zinc-400 hover:bg-zinc-800/50 hover:text-white border-zinc-800/60"
                  )}
                  onClick={() => changeLanguage("ru")}
                >
                  {t("settingsPage.languageRu")}
                </button>
                <button
                  className={cn(
                    "flex-1 py-2.5 px-4 rounded-xl font-medium text-sm transition-colors border",
                    i18n.language === "en"
                      ? "bg-[#7C66DC] text-white border-[#7C66DC]"
                      : "bg-zinc-900/50 text-zinc-400 hover:bg-zinc-800/50 hover:text-white border-zinc-800/60"
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
