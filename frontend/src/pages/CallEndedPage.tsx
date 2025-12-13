import React from "react";
import { Link } from "react-router-dom";
import { PhoneOff } from "lucide-react";
import { motion } from "framer-motion";
import MobileFrame from "../components/MobileFrame";

const CallEndedPage: React.FC = () => {
  return (
    <MobileFrame>
      <div className="relative flex h-full flex-col justify-center items-center text-white px-6">
        {/* Иконка завершенного звонка */}
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.3 }}
          className="mb-8"
        >
          <div className="w-24 h-24 rounded-full bg-zinc-900/60 border border-zinc-800/50 flex items-center justify-center">
            <PhoneOff className="w-12 h-12 text-zinc-400 stroke-[1.5]" />
          </div>
        </motion.div>

        {/* Заголовок */}
        <motion.h1
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.3, delay: 0.1 }}
          className="text-3xl font-semibold leading-tight tracking-tight text-center mb-3"
        >
          Звонок завершен
        </motion.h1>

        {/* Описание */}
        <motion.p
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.3, delay: 0.2 }}
          className="text-center text-zinc-400 mb-8 max-w-sm"
        >
          Этот звонок больше не активен. Вы можете создать новый звонок или присоединиться к другому.
        </motion.p>

        {/* Кнопка на главную */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.3, delay: 0.3 }}
          className="w-full max-w-md"
        >
          <Link to="/">
            <motion.button
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              className="flex h-[60px] w-full items-center justify-center gap-3 rounded-2xl text-[17px] font-medium transition-colors bg-[#7C66DC] text-white hover:bg-[#6A55CA] shadow-[0_4px_20px_-4px_rgba(124,102,220,0.5)]"
            >
              На главную
            </motion.button>
          </Link>
        </motion.div>
      </div>
    </MobileFrame>
  );
};

export default CallEndedPage;
