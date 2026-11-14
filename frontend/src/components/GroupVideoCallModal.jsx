import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  PhoneOff,
  Video,
  VideoOff,
  Mic,
  MicOff,
  Monitor,
  MonitorOff,
  Sparkles,
  Users,
  X,
  Volume2,
  Pin,
  PinOff
} from 'lucide-react';
import { DEFAULT_AVATAR } from '../constants/defaults';
import { formatCallDuration } from '../utils/callMediaLogic';
import { CALL_FILTERS, preloadFaceFilterAi } from '../utils/faceFilterLogic';
import { getMeshGridLayoutClass } from '../utils/meshCallManager';

/**
 * Tile hiển thị video của một thành viên trong phòng gọi nhóm (hỗ trợ Ghim và Chia sẻ màn hình)
 */
function ParticipantVideoTile({
  participant,
  stream,
  cameraStream = null,
  isLocal = false,
  isMuted = false,
  isVideoOff = false,
  isScreenShare = false,
  isPinned = false,
  onTogglePin = null
}) {
  const videoRef = useRef(null);
  const cameraVideoRef = useRef(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
      videoRef.current.play().catch(() => {});
    }
  }, [stream]);

  useEffect(() => {
    if (cameraVideoRef.current && cameraStream) {
      cameraVideoRef.current.srcObject = cameraStream;
      cameraVideoRef.current.play().catch(() => {});
    }
  }, [cameraStream, isScreenShare, isVideoOff]);

  const name = participant?.name || (isLocal ? 'Bạn' : 'Thành viên');
  const avatar = participant?.avatar || DEFAULT_AVATAR;

  return (
    <div
      className={`relative w-full h-full min-h-[140px] bg-slate-900 rounded-2xl overflow-hidden border transition-all duration-300 flex items-center justify-center group ${
        isPinned
          ? 'border-blue-500 shadow-xl shadow-blue-500/20 ring-2 ring-blue-500/40'
          : 'border-slate-700/60 shadow-lg hover:border-slate-600'
      }`}
    >
      {/* Thẻ Video hiển thị luồng trực tiếp (Khi chia sẻ màn hình, màn hình luôn được hiển thị độc lập với camera) */}
      {stream && (isScreenShare || !isVideoOff) ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={isLocal}
          className={`w-full h-full ${
            isScreenShare ? 'object-contain bg-black' : 'object-cover'
          } ${isLocal && !isScreenShare ? 'scale-x-[-1]' : ''}`}
        />
      ) : (
        /* Avatar đại diện khi tắt camera hoặc chưa có video */
        <div className="flex flex-col items-center justify-center p-4">
          <div className="relative">
            <span className="absolute -inset-1 rounded-full bg-blue-500/20 animate-pulse"></span>
            <img
              src={avatar}
              alt={name}
              className="relative w-16 h-16 sm:w-20 sm:h-20 rounded-full object-cover border-2 border-slate-700 shadow-md"
            />
          </div>
          <p className="mt-2 text-xs sm:text-sm font-semibold text-slate-200 truncate max-w-[160px] text-center">
            {name}
          </p>
        </div>
      )}

      {/* Picture-in-Picture camera của bạn khi đang chia sẻ màn hình */}
      {isScreenShare && isLocal && cameraStream && !isVideoOff && (
        <div className="absolute bottom-12 right-2.5 w-24 h-18 sm:w-32 sm:h-24 rounded-xl overflow-hidden border-2 border-white/30 shadow-2xl z-20 bg-slate-900 pointer-events-auto">
          <video
            ref={cameraVideoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover scale-x-[-1]"
          />
          <div className="absolute bottom-1 left-1.5 px-1 py-0.2 rounded bg-black/70 text-[9px] text-white font-medium">
            Camera
          </div>
        </div>
      )}

      {/* Nút Ghim / Bỏ ghim và Badge ở góc trên bên phải */}
      <div className="absolute top-2.5 right-2.5 flex items-center gap-1.5 z-10">
        {isPinned && (
          <span className="px-2 py-0.5 rounded-md bg-blue-600/90 text-white text-[10px] font-bold flex items-center gap-1 backdrop-blur-md shadow-sm">
            <Pin className="w-3 h-3" />
            <span>Đã ghim</span>
          </span>
        )}
        {onTogglePin && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onTogglePin();
            }}
            title={isPinned ? 'Bỏ ghim (trở về dạng lưới)' : 'Ghim lên tiêu điểm chính'}
            className={`p-1.5 rounded-lg backdrop-blur-md transition shadow-md cursor-pointer ${
              isPinned
                ? 'bg-blue-600 text-white hover:bg-blue-700'
                : 'bg-black/60 text-slate-300 hover:text-white hover:bg-blue-600/90 opacity-90 sm:opacity-0 group-hover:opacity-100'
            }`}
          >
            {isPinned ? <PinOff className="w-3.5 h-3.5" /> : <Pin className="w-3.5 h-3.5" />}
          </button>
        )}
      </div>

      {/* Badge màn hình chia sẻ (nếu có) */}
      {isScreenShare && (
        <div className="absolute top-2.5 left-2.5 flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-500/90 text-white text-[10px] font-semibold backdrop-blur-md shadow-sm">
          <Monitor className="w-3 h-3" />
          <span>{isLocal ? 'Màn hình của bạn' : 'Màn hình chia sẻ'}</span>
        </div>
      )}

      {/* Tên thành viên và trạng thái Mic ở góc dưới */}
      <div className="absolute bottom-2.5 left-2.5 right-2.5 flex items-center justify-between pointer-events-none">
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-black/60 backdrop-blur-md text-white text-[11px] sm:text-xs font-medium max-w-[80%] truncate">
          <span className="truncate">{name} {isLocal && '(Bạn)'}</span>
        </div>
        <div className={`p-1.5 rounded-lg backdrop-blur-md ${isMuted ? 'bg-rose-500/80 text-white' : 'bg-black/60 text-emerald-400'}`}>
          {isMuted ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
        </div>
      </div>
    </div>
  );
}

export default function GroupVideoCallModal({
  isOpen = false,
  groupName = 'Nhóm chat',
  groupAvatar = null,
  currentUser = null,
  localStream = null,
  rawCameraStream = null,
  participants = [], // Array of { user_id, name, avatar }
  remoteStreams = {}, // Map/Object: remoteUserId -> MediaStream
  callDuration = 0,
  isMuted = false,
  isVideoOff = false,
  isScreenSharing = false,
  screenSharingUsers = {}, // Map/Object: userId -> boolean
  activeFilterId = 'none',
  onLeaveCall,
  onToggleMic,
  onToggleCamera,
  onToggleScreenShare,
  onSelectFilter
}) {
  const [showFilterDrawer, setShowFilterDrawer] = useState(false);
  const [filterCategory, setFilterCategory] = useState('all');
  const [pinnedId, setPinnedId] = useState(null);

  const currentUserIdStr = String(currentUser?.id || 'me');

  // Tự động ghim khi bản thân hoặc thành viên khác bắt đầu chia sẻ màn hình
  useEffect(() => {
    if (isScreenSharing) {
      setPinnedId(currentUserIdStr);
      return;
    }
    const sharingRemoteUserId = Object.keys(screenSharingUsers).find(
      uid => screenSharingUsers[uid] && uid !== currentUserIdStr
    );
    if (sharingRemoteUserId) {
      setPinnedId(String(sharingRemoteUserId));
    } else if (pinnedId === currentUserIdStr) {
      setPinnedId(null);
    }
  }, [isScreenSharing, screenSharingUsers, currentUserIdStr]);

  useEffect(() => {
    if (isOpen) {
      preloadFaceFilterAi();
    }
  }, [isOpen]);

  const displayedFilters = useMemo(() => {
    if (filterCategory === 'all') return CALL_FILTERS;
    return CALL_FILTERS.filter(f => f.category === 'all' || f.category === filterCategory);
  }, [filterCategory]);

  if (!isOpen) return null;

  // Danh sách hiển thị: kết hợp cả danh sách participants metadata và các luồng remoteStreams đang kết nối
  const remoteUserIds = Array.from(new Set([
    ...participants.map(p => String(p.user_id)),
    ...Object.keys(remoteStreams)
  ])).filter(uid => uid && uid !== currentUserIdStr);

  const remoteTiles = remoteUserIds.map(uid => {
    const p = participants.find(part => String(part.user_id) === uid) || {
      user_id: uid,
      name: 'Thành viên',
      avatar: DEFAULT_AVATAR
    };
    return {
      userId: uid,
      participant: p,
      stream: remoteStreams[uid],
      isLocal: false,
      isMuted: false,
      isVideoOff: false,
      isScreenShare: Boolean(screenSharingUsers[uid])
    };
  });

  const allTiles = [
    {
      userId: currentUserIdStr,
      participant: {
        user_id: currentUserIdStr,
        name: currentUser?.name || 'Bạn',
        avatar: currentUser?.avatar || DEFAULT_AVATAR
      },
      stream: localStream,
      cameraStream: rawCameraStream,
      isLocal: true,
      isMuted,
      isVideoOff,
      isScreenShare: isScreenSharing
    },
    ...remoteTiles
  ];

  const pinnedTile = pinnedId ? allTiles.find(t => t.userId === pinnedId) : null;
  const otherTiles = pinnedId ? allTiles.filter(t => t.userId !== pinnedId) : [];
  const gridLayoutClass = getMeshGridLayoutClass(allTiles.length);

  return (
    <div className="fixed inset-0 z-50 bg-slate-950 flex flex-col select-none overflow-hidden animate-fadeIn">
      {/* 1. THANH TIÊU ĐỀ TRÊN CÙNG (TOP HEADER) */}
      <header className="relative flex items-center justify-between px-4 sm:px-6 py-3 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 z-10">
        <div className="flex items-center gap-3">
          <img
            src={groupAvatar || DEFAULT_AVATAR}
            alt={groupName}
            className="w-10 h-10 rounded-full object-cover border border-slate-700 shadow"
          />
          <div>
            <h2 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
              <span>{groupName}</span>
              <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-medium border border-emerald-500/30">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
                <span>{allTiles.length} người</span>
              </span>
              {pinnedTile && (
                <span className="hidden sm:inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 font-medium border border-blue-500/30">
                  <Pin className="w-3 h-3" />
                  <span>Đang ghim: {pinnedTile.participant?.name || 'Thành viên'}</span>
                </span>
              )}
            </h2>
            <p className="text-xs text-slate-400 font-mono">
              {formatCallDuration(callDuration)}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {pinnedTile && (
            <button
              type="button"
              onClick={() => setPinnedId(null)}
              className="text-xs px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl transition flex items-center gap-1 cursor-pointer"
              title="Bỏ ghim tiêu điểm"
            >
              <PinOff className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Bỏ ghim</span>
            </button>
          )}
          <button
            type="button"
            onClick={onLeaveCall}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-full transition cursor-pointer"
            title="Rời cuộc gọi"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* 2. KHÔNG GIAN LƯỚI HOẶC TIÊU ĐIỂM GHIM (SPOTLIGHT / MESH GRID) */}
      <main className="flex-1 p-2 sm:p-4 overflow-hidden flex flex-col items-center justify-center min-h-0">
        {pinnedTile ? (
          <div className="w-full h-full flex flex-col min-h-0 gap-3">
            {/* Vùng Tiêu Điểm Ghim Lớn (Stage / Spotlight View) */}
            <div className="flex-1 min-h-0 w-full flex items-center justify-center">
              <div className="w-full h-full max-w-6xl max-h-full">
                <ParticipantVideoTile
                  participant={pinnedTile.participant}
                  stream={pinnedTile.stream}
                  cameraStream={pinnedTile.cameraStream}
                  isLocal={pinnedTile.isLocal}
                  isMuted={pinnedTile.isMuted}
                  isVideoOff={pinnedTile.isVideoOff}
                  isScreenShare={pinnedTile.isScreenShare}
                  isPinned={true}
                  onTogglePin={() => setPinnedId(null)}
                />
              </div>
            </div>

            {/* Dải Filmstrip các thành viên còn lại ở dưới */}
            {otherTiles.length > 0 && (
              <div className="shrink-0 w-full py-1 flex items-center justify-center gap-3 overflow-x-auto scrollbar-thin">
                {otherTiles.map(tile => (
                  <div key={tile.userId} className="w-36 sm:w-48 h-24 sm:h-32 shrink-0">
                    <ParticipantVideoTile
                      participant={tile.participant}
                      stream={tile.stream}
                      cameraStream={tile.cameraStream}
                      isLocal={tile.isLocal}
                      isMuted={tile.isMuted}
                      isVideoOff={tile.isVideoOff}
                      isScreenShare={tile.isScreenShare}
                      isPinned={false}
                      onTogglePin={() => setPinnedId(tile.userId)}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          /* Chế độ Lưới Cân Đối khi chưa ghim ai */
          <div className={`w-full h-full max-w-7xl max-h-full grid gap-3 sm:gap-4 ${gridLayoutClass}`}>
            {allTiles.map(tile => (
              <ParticipantVideoTile
                key={tile.userId}
                participant={tile.participant}
                stream={tile.stream}
                cameraStream={tile.cameraStream}
                isLocal={tile.isLocal}
                isMuted={tile.isMuted}
                isVideoOff={tile.isVideoOff}
                isScreenShare={tile.isScreenShare}
                isPinned={false}
                onTogglePin={() => setPinnedId(tile.userId)}
              />
            ))}
          </div>
        )}
      </main>

      {/* 3. NGĂN CHỌN FILTER KHUÔN MẶT AR (FILTER DRAWER) */}
      {showFilterDrawer && (
        <div className="absolute bottom-24 left-1/2 -translate-x-1/2 w-[95%] max-w-lg bg-slate-900/95 backdrop-blur-xl border border-slate-700/80 rounded-3xl p-4 shadow-2xl z-30 animate-scaleUp">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span>Hiệu ứng khuôn mặt & Màu sắc</span>
            </div>
            <button
              type="button"
              onClick={() => setShowFilterDrawer(false)}
              className="p-1 text-slate-400 hover:text-white rounded-full transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Phân loại filter */}
          <div className="flex gap-2 my-3">
            {[
              { id: 'all', label: 'Tất cả' },
              { id: 'ar', label: '✨ AR Vui nhộn' },
              { id: 'color', label: '🎨 Bộ lọc màu' }
            ].map(cat => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setFilterCategory(cat.id)}
                className={`text-xs px-3 py-1.5 rounded-full font-medium transition cursor-pointer ${
                  filterCategory === cat.id
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-500/25'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Danh sách các Filter */}
          <div className="grid grid-cols-4 sm:grid-cols-6 gap-2.5 max-h-48 overflow-y-auto pr-1">
            {displayedFilters.map(filter => {
              const isActive = activeFilterId === filter.id;
              return (
                <button
                  key={filter.id}
                  type="button"
                  onClick={() => onSelectFilter && onSelectFilter(filter.id)}
                  className={`flex flex-col items-center gap-1.5 p-2 rounded-2xl border transition cursor-pointer ${
                    isActive
                      ? 'border-blue-500 bg-blue-500/15 shadow-md shadow-blue-500/20'
                      : 'border-slate-800 bg-slate-800/60 hover:bg-slate-800 hover:border-slate-700'
                  }`}
                  title={filter.description}
                >
                  <span className="text-2xl">{filter.icon}</span>
                  <span className={`text-[11px] font-medium truncate w-full text-center ${
                    isActive ? 'text-blue-400 font-semibold' : 'text-slate-300'
                  }`}>
                    {filter.name}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* 4. THANH ĐIỀU KHIỂN DƯỚI CÙNG (BOTTOM CONTROL BAR) */}
      <footer className="relative flex items-center justify-center gap-3 sm:gap-5 px-4 py-4 bg-slate-900/90 backdrop-blur-md border-t border-slate-800 z-10">
        {/* Nút Bật/Tắt Mic */}
        <button
          type="button"
          onClick={onToggleMic}
          className={`w-12 h-12 rounded-full flex items-center justify-center transition shadow-lg cursor-pointer ${
            isMuted
              ? 'bg-rose-600 hover:bg-rose-700 text-white shadow-rose-600/30'
              : 'bg-slate-800 hover:bg-slate-700 text-white shadow-black/40'
          }`}
          title={isMuted ? 'Bật Mic' : 'Tắt Mic'}
        >
          {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
        </button>

        {/* Nút Bật/Tắt Camera */}
        <button
          type="button"
          onClick={onToggleCamera}
          className={`w-12 h-12 rounded-full flex items-center justify-center transition shadow-lg cursor-pointer ${
            isVideoOff
              ? 'bg-rose-600 hover:bg-rose-700 text-white shadow-rose-600/30'
              : 'bg-slate-800 hover:bg-slate-700 text-white shadow-black/40'
          }`}
          title={isVideoOff ? 'Bật Camera' : 'Tắt Camera'}
        >
          {isVideoOff ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
        </button>

        {/* Nút Chia sẻ Màn hình */}
        <button
          type="button"
          onClick={onToggleScreenShare}
          className={`w-12 h-12 rounded-full flex items-center justify-center transition shadow-lg cursor-pointer ${
            isScreenSharing
              ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-600/30 ring-2 ring-blue-400'
              : 'bg-slate-800 hover:bg-slate-700 text-white shadow-black/40'
          }`}
          title={isScreenSharing ? 'Dừng chia sẻ màn hình' : 'Chia sẻ màn hình'}
        >
          {isScreenSharing ? <MonitorOff className="w-5 h-5" /> : <Monitor className="w-5 h-5" />}
        </button>

        {/* Nút Mở Filter AR */}
        <button
          type="button"
          onClick={() => setShowFilterDrawer(prev => !prev)}
          className={`w-12 h-12 rounded-full flex items-center justify-center transition shadow-lg cursor-pointer ${
            activeFilterId !== 'none'
              ? 'bg-amber-500 hover:bg-amber-600 text-white shadow-amber-500/30 ring-2 ring-amber-400'
              : 'bg-slate-800 hover:bg-slate-700 text-white shadow-black/40'
          }`}
          title="Chọn hiệu ứng khuôn mặt & bộ lọc"
        >
          <Sparkles className="w-5 h-5" />
        </button>

        {/* Nút Rời Cuộc Gọi */}
        <button
          type="button"
          onClick={onLeaveCall}
          className="w-14 h-12 rounded-full bg-rose-600 hover:bg-rose-700 text-white flex items-center justify-center transition shadow-lg shadow-rose-600/40 hover:scale-105 cursor-pointer ml-2"
          title="Rời khỏi cuộc gọi nhóm"
        >
          <PhoneOff className="w-6 h-6" />
        </button>
      </footer>
    </div>
  );
}

