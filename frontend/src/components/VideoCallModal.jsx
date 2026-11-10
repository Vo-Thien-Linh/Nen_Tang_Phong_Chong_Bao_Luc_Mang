import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Phone,
  PhoneOff,
  Video,
  VideoOff,
  Mic,
  MicOff,
  User,
  Volume2,
  Sparkles,
  X
} from 'lucide-react';
import { DEFAULT_AVATAR } from '../constants/defaults';
import { CALL_STATUS, formatCallDuration } from '../utils/callMediaLogic';
import { CALL_FILTERS } from '../utils/faceFilterLogic';

export default function VideoCallModal({
  callStatus = CALL_STATUS.IDLE,
  callType = 'video',
  partnerUser = null,
  localStream = null,
  remoteStream = null,
  callDuration = 0,
  isMuted = false,
  isVideoOff = false,
  activeFilterId = 'none',
  onAccept,
  onDecline,
  onEndCall,
  onToggleMic,
  onToggleCamera,
  onSelectFilter
}) {
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const [showFilterDrawer, setShowFilterDrawer] = useState(false);
  const [filterCategory, setFilterCategory] = useState('all');

  const displayedFilters = useMemo(() => {
    if (filterCategory === 'all') return CALL_FILTERS;
    return CALL_FILTERS.filter(f => f.category === 'all' || f.category === filterCategory);
  }, [filterCategory]);

  // Gắn stream vào các thẻ video DOM
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
      localVideoRef.current.play().catch(() => {});
    }
  }, [localStream, callStatus]);

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
      remoteVideoRef.current.play().catch(() => {});
    }
  }, [remoteStream, callStatus]);

  if (callStatus === CALL_STATUS.IDLE) {
    return null;
  }

  const partnerName = partnerUser?.name || 'Người dùng';
  const partnerAvatar = partnerUser?.avatar || DEFAULT_AVATAR;

  // GIAO DIỆN 1: CUỘC GỌI ĐẾN (INCOMING CALL)
  if (callStatus === CALL_STATUS.INCOMING) {
    return (
      <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
        <div className="bg-slate-900 border border-slate-800 text-white rounded-3xl p-6 sm:p-8 w-full max-w-sm flex flex-col items-center text-center shadow-2xl animate-scaleUp">
          <div className="relative mb-6">
            <span className="absolute -inset-3 rounded-full bg-blue-500/30 animate-ping"></span>
            <span className="absolute -inset-1 rounded-full bg-blue-500/50 animate-pulse"></span>
            <img
              src={partnerAvatar}
              alt={partnerName}
              className="relative w-24 h-24 rounded-full object-cover border-2 border-white/20 shadow-lg"
            />
          </div>

          <h3 className="text-xl font-bold tracking-tight text-white mb-1">{partnerName}</h3>
          <p className="text-sm text-blue-400 font-medium mb-6 flex items-center gap-1.5">
            <Volume2 className="w-4 h-4 animate-bounce" />
            <span>Cuộc gọi {callType === 'video' ? 'video' : 'thoại'} đến...</span>
          </p>

          <div className="flex items-center justify-center gap-6 w-full pt-2">
            <button
              type="button"
              onClick={onDecline}
              className="flex flex-col items-center gap-2 group cursor-pointer"
            >
              <div className="w-14 h-14 rounded-full bg-rose-600 hover:bg-rose-700 text-white flex items-center justify-center transition shadow-lg shadow-rose-600/30 group-hover:scale-105">
                <PhoneOff className="w-6 h-6" />
              </div>
              <span className="text-xs text-slate-300 font-medium">Từ chối</span>
            </button>

            <button
              type="button"
              onClick={onAccept}
              className="flex flex-col items-center gap-2 group cursor-pointer"
            >
              <div className="w-14 h-14 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center transition shadow-lg shadow-emerald-600/30 group-hover:scale-105 animate-bounce">
                {callType === 'video' ? <Video className="w-6 h-6" /> : <Phone className="w-6 h-6" />}
              </div>
              <span className="text-xs text-slate-300 font-medium">Trả lời</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // GIAO DIỆN 2: ĐANG GỌI ĐI (OUTGOING CALL)
  if (callStatus === CALL_STATUS.OUTGOING) {
    return (
      <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
        <div className="bg-slate-900 border border-slate-800 text-white rounded-3xl p-6 sm:p-8 w-full max-w-sm flex flex-col items-center text-center shadow-2xl animate-scaleUp">
          <div className="relative mb-6">
            <span className="absolute -inset-3 rounded-full bg-blue-500/20 animate-ping"></span>
            <img
              src={partnerAvatar}
              alt={partnerName}
              className="relative w-24 h-24 rounded-full object-cover border-2 border-white/20 shadow-lg"
            />
          </div>

          <h3 className="text-xl font-bold tracking-tight text-white mb-1">{partnerName}</h3>
          <p className="text-sm text-slate-400 font-medium mb-8 animate-pulse">
            Đang đổ chuông cuộc gọi {callType === 'video' ? 'video' : 'thoại'}...
          </p>

          <button
            type="button"
            onClick={onEndCall}
            className="flex flex-col items-center gap-2 group cursor-pointer"
          >
            <div className="w-14 h-14 rounded-full bg-rose-600 hover:bg-rose-700 text-white flex items-center justify-center transition shadow-lg shadow-rose-600/30 group-hover:scale-105">
              <PhoneOff className="w-6 h-6" />
            </div>
            <span className="text-xs text-slate-300 font-medium">Hủy cuộc gọi</span>
          </button>
        </div>
      </div>
    );
  }

  // GIAO DIỆN 3: ĐANG TRONG CUỘC GỌI (CONNECTED CALL)
  return (
    <div className="fixed inset-0 z-50 bg-slate-950 flex flex-col justify-between overflow-hidden animate-fadeIn select-none">
      {/* Header cuộc gọi */}
      <div className="p-4 sm:p-6 flex items-center justify-between bg-gradient-to-b from-black/80 to-transparent z-10">
        <div className="flex items-center gap-3">
          <img
            src={partnerAvatar}
            alt={partnerName}
            className="w-10 h-10 rounded-full object-cover border border-white/20"
          />
          <div>
            <h4 className="text-white font-bold text-sm sm:text-base">{partnerName}</h4>
            <div className="flex items-center gap-2 text-xs text-emerald-400 font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span>Đang kết nối • {formatCallDuration(callDuration)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Vùng hiển thị Video chính (Remote Video) */}
      <div className="flex-1 relative flex items-center justify-center bg-slate-900 overflow-hidden">
        <video
          ref={remoteVideoRef}
          autoPlay
          playsInline
          className={`w-full h-full object-contain bg-black ${remoteStream ? 'block' : 'hidden'}`}
        />
        {!remoteStream && (
          <div className="flex flex-col items-center justify-center text-center p-6">
            <img
              src={partnerAvatar}
              alt={partnerName}
              className="w-28 h-28 rounded-full object-cover border-4 border-slate-700 shadow-xl mb-4"
            />
            <h4 className="text-white text-lg font-bold">{partnerName}</h4>
            <p className="text-xs text-slate-400 mt-1">Đang chờ nhận tín hiệu video từ đối phương...</p>
          </div>
        )}

        {/* Video thu nhỏ của chính mình (Local PiP Video) */}
        {callType === 'video' && (
          <div className="absolute bottom-4 right-4 sm:bottom-6 sm:right-6 w-28 h-40 sm:w-36 sm:h-52 bg-slate-800 rounded-2xl overflow-hidden border-2 border-white/20 shadow-2xl z-20">
            {localStream && !isVideoOff ? (
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover scale-x-[-1]"
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 bg-slate-800/90 text-xs">
                <VideoOff className="w-6 h-6 mb-1 text-slate-500" />
                <span>Camera tắt</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Drawer chọn Filter AR & Hiệu ứng khuôn mặt */}
      {showFilterDrawer && callType === 'video' && !isVideoOff && (
        <div className="absolute bottom-24 sm:bottom-28 inset-x-4 sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2 sm:w-[520px] bg-slate-900/95 backdrop-blur-md border border-slate-700/80 rounded-2xl p-3 shadow-2xl z-30 animate-fadeIn">
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800 text-xs">
            <div className="flex items-center gap-1.5 font-semibold text-slate-200">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span>Hiệu ứng & Filter khuôn mặt</span>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setFilterCategory('all')}
                className={`px-2 py-0.5 rounded-full text-[11px] font-medium transition cursor-pointer ${
                  filterCategory === 'all' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                Tất cả
              </button>
              <button
                type="button"
                onClick={() => setFilterCategory('ar')}
                className={`px-2 py-0.5 rounded-full text-[11px] font-medium transition cursor-pointer ${
                  filterCategory === 'ar' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                Khuôn mặt
              </button>
              <button
                type="button"
                onClick={() => setFilterCategory('color')}
                className={`px-2 py-0.5 rounded-full text-[11px] font-medium transition cursor-pointer ${
                  filterCategory === 'color' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                Màu sắc
              </button>
              <button
                type="button"
                onClick={() => setShowFilterDrawer(false)}
                className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 ml-1 transition cursor-pointer"
                title="Đóng bảng hiệu ứng"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Dải cuộn ngang các Filter */}
          <div className="flex items-center gap-2 overflow-x-auto py-1.5 scrollbar-thin scrollbar-thumb-slate-700">
            {displayedFilters.map((f) => {
              const isSelected = (activeFilterId || 'none') === f.id;
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => onSelectFilter && onSelectFilter(f.id)}
                  className={`flex flex-col items-center gap-1 p-2 rounded-xl shrink-0 min-w-[68px] transition cursor-pointer group ${
                    isSelected
                      ? 'bg-blue-600/30 border-2 border-blue-500 shadow-lg shadow-blue-500/30'
                      : 'bg-slate-800/60 hover:bg-slate-800 border border-slate-700/60 hover:border-slate-600'
                  }`}
                  title={f.description}
                >
                  <span className="text-2xl group-hover:scale-110 transition-transform">
                    {f.icon}
                  </span>
                  <span className={`text-[11px] font-medium truncate max-w-[60px] ${
                    isSelected ? 'text-blue-300 font-semibold' : 'text-slate-300'
                  }`}>
                    {f.name}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Thanh công cụ điều khiển cuộc gọi phía dưới (Bottom Controls) */}
      <div className="p-4 sm:p-6 bg-gradient-to-t from-black/90 to-transparent flex items-center justify-center gap-4 sm:gap-6 z-10">
        {/* Nút Bật/Tắt Micro */}
        <button
          type="button"
          onClick={onToggleMic}
          className={`p-3.5 sm:p-4 rounded-full transition cursor-pointer shadow-lg ${
            isMuted
              ? 'bg-rose-500 hover:bg-rose-600 text-white'
              : 'bg-slate-800/80 hover:bg-slate-700 text-white border border-white/10'
          }`}
          title={isMuted ? 'Bật Mic' : 'Tắt Mic'}
        >
          {isMuted ? <MicOff className="w-5 h-5 sm:w-6 sm:h-6" /> : <Mic className="w-5 h-5 sm:w-6 sm:h-6" />}
        </button>

        {/* Nút Kết thúc cuộc gọi */}
        <button
          type="button"
          onClick={onEndCall}
          className="p-4 sm:p-5 rounded-full bg-rose-600 hover:bg-rose-700 text-white transition cursor-pointer shadow-xl shadow-rose-600/40 hover:scale-105"
          title="Kết thúc cuộc gọi"
        >
          <PhoneOff className="w-6 h-6 sm:w-7 sm:h-7" />
        </button>

        {/* Nút Bật/Tắt Camera */}
        {callType === 'video' && (
          <button
            type="button"
            onClick={onToggleCamera}
            className={`p-3.5 sm:p-4 rounded-full transition cursor-pointer shadow-lg ${
              isVideoOff
                ? 'bg-rose-500 hover:bg-rose-600 text-white'
                : 'bg-slate-800/80 hover:bg-slate-700 text-white border border-white/10'
            }`}
            title={isVideoOff ? 'Bật Camera' : 'Tắt Camera'}
          >
            {isVideoOff ? <VideoOff className="w-5 h-5 sm:w-6 sm:h-6" /> : <Video className="w-5 h-5 sm:w-6 sm:h-6" />}
          </button>
        )}

        {/* Nút Mở/Đóng Bộ lọc AR & Hiệu ứng */}
        {callType === 'video' && !isVideoOff && (
          <button
            type="button"
            onClick={() => setShowFilterDrawer(!showFilterDrawer)}
            className={`p-3.5 sm:p-4 rounded-full transition cursor-pointer shadow-lg ${
              showFilterDrawer || (activeFilterId && activeFilterId !== 'none')
                ? 'bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold shadow-amber-500/30'
                : 'bg-slate-800/80 hover:bg-slate-700 text-amber-300 border border-white/10'
            }`}
            title={showFilterDrawer ? 'Đóng bộ lọc' : 'Chọn Filter & Hiệu ứng'}
          >
            <Sparkles className="w-5 h-5 sm:w-6 sm:h-6" />
          </button>
        )}
      </div>
    </div>
  );
}
