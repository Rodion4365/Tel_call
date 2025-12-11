import React from "react";
import { ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { cn } from "../lib/utils";
import { Switch } from "../components/ui/switch";
import { MobileFrame } from "../components/layout/MobileFrame";
import { TopBar } from "../components/layout/TopBar";
import { useAuth } from "../contexts/AuthContext";

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

export default function SettingsPageNew() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [micEnabled, setMicEnabled] = React.useState(true);

  return (
    <MobileFrame>
      <div className="h-full w-full bg-gradient-to-b from-[#0f111a] to-black text-white font-sans overflow-y-auto pb-20">
        <TopBar showBack={true} backTo="/" />

        <div className="px-5 pt-2 max-w-md mx-auto space-y-6">
          <div>
              <div className="text-xs font-semibold tracking-widest text-zinc-500 uppercase mb-1">
                  Настройки
              </div>
              <h1 className="text-2xl font-bold text-white">
                  Ваш профиль и звонки
              </h1>
          </div>

          {/* Language Card */}
          <div>
              <SectionLabel>Язык</SectionLabel>
              <Card>
                  <CardTitle>Язык</CardTitle>
                  <div className="flex gap-3 mt-4">
                      <button className="flex-1 py-2.5 px-4 rounded-xl bg-zinc-800 text-white font-medium text-sm transition-colors border border-zinc-700">
                          Русский
                      </button>
                      <button className="flex-1 py-2.5 px-4 rounded-xl bg-transparent text-zinc-400 font-medium text-sm hover:bg-zinc-800/50 hover:text-white transition-colors border border-zinc-800">
                          English
                      </button>
                  </div>
              </Card>
          </div>

          {/* Profile Card */}
          <div>
              <SectionLabel>Профиль</SectionLabel>
              <Card className="space-y-4">
                  <CardTitle>Данные аккаунта</CardTitle>

                  <div className="flex justify-between items-center py-1">
                      <span className="text-zinc-400 font-medium">Имя</span>
                      <span className="text-white font-medium">{user?.first_name || "Не указано"}</span>
                  </div>
                  <div className="w-full h-px bg-zinc-800/50" />
                  <div className="flex justify-between items-center py-1">
                      <span className="text-zinc-400 font-medium">Username</span>
                      <span className="text-[#8B78E6] font-medium">@{user?.username || "Не указан"}</span>
                  </div>
              </Card>
          </div>

          {/* Call Settings Card */}
          <div>
              <SectionLabel>Настройки по умолчанию</SectionLabel>
              <Card>
                  <CardTitle>Параметры звонка</CardTitle>

                  <div className="flex justify-between items-center mt-6">
                      <div className="space-y-1">
                          <div className="text-white font-medium text-[17px]">Микрофон</div>
                          <div className="text-zinc-500 text-sm">Включён по умолчанию</div>
                      </div>
                      <Switch
                        checked={micEnabled}
                        onCheckedChange={setMicEnabled}
                        className="data-[state=checked]:bg-[#7C66DC]"
                      />
                  </div>
              </Card>
          </div>

          {/* Security Card */}
          <div>
              <SectionLabel>Безопасность</SectionLabel>
              <Card>
                   <CardTitle>Шифрование</CardTitle>
                   <p className="text-zinc-500 text-[15px] leading-relaxed">
                      Все ваши звонки защищены сквозным шифрованием. Никто, включая нас, не может прослушать их.
                   </p>
              </Card>
          </div>

          {/* User Agreement Card */}
          <div className="pb-6">
              <div
                onClick={() => navigate("/terms")}
                className="cursor-pointer"
              >
                  <SectionLabel>Информация</SectionLabel>
                  <Card className="active:bg-zinc-800/60 transition-colors group flex justify-between items-center py-6">
                      <span className="text-white font-semibold text-lg">Пользовательское соглашение</span>
                      <ChevronRight className="w-6 h-6 text-zinc-600 group-hover:text-white transition-colors" />
                  </Card>
              </div>
          </div>
        </div>
      </div>
    </MobileFrame>
  );
}
