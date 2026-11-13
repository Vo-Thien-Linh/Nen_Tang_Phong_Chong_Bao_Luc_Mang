import { useState, useEffect } from 'react';
import { X, Search, Users, Check, Loader2, AlertCircle } from 'lucide-react';
import { friendService } from '../services/friendService';
import { messageService } from '../services/messageService';
import { DEFAULT_AVATAR } from '../constants/defaults';
import { useTranslation } from '../utils/i18n';

export default function CreateGroupModal({ isOpen, onClose, onGroupCreated, currentUser }) {
  const { t } = useTranslation();
  const [groupName, setGroupName] = useState('');
  const [friends, setFriends] = useState([]);
  const [selectedFriendIds, setSelectedFriendIds] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoadingFriends, setIsLoadingFriends] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (!isOpen) {
      setGroupName('');
      setSelectedFriendIds([]);
      setSearchTerm('');
      setErrorMsg('');
      return;
    }

    const loadFriends = async () => {
      setIsLoadingFriends(true);
      setErrorMsg('');
      try {
        const list = await friendService.getFriendsList();
        if (list && Array.isArray(list)) {
          setFriends(list.map(f => ({
            id: String(f.id),
            name: f.name || f.full_name || 'Người dùng',
            username: f.username || '',
            avatar: f.avatar || f.avatar_url || DEFAULT_AVATAR
          })));
        } else {
          setFriends([]);
        }
      } catch (err) {
        console.warn('Lỗi tải danh sách bạn bè:', err);
        setErrorMsg('Không thể tải danh sách bạn bè');
      } finally {
        setIsLoadingFriends(false);
      }
    };

    loadFriends();
  }, [isOpen]);

  if (!isOpen) return null;

  const toggleSelectFriend = (id) => {
    setSelectedFriendIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const filteredFriends = friends.filter(f => {
    const term = searchTerm.toLowerCase();
    return f.name.toLowerCase().includes(term) || f.username.toLowerCase().includes(term);
  });

  const handleCreateGroup = async (e) => {
    e?.preventDefault();
    const trimmedName = groupName.trim();
    if (!trimmedName) {
      setErrorMsg('Vui lòng nhập tên nhóm');
      return;
    }

    if (selectedFriendIds.length < 2) {
      setErrorMsg('Vui lòng chọn ít nhất 2 bạn bè để tạo nhóm (tối thiểu 3 thành viên)');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg('');

    try {
      const newGroup = await messageService.createGroup(trimmedName, selectedFriendIds);
      if (onGroupCreated) {
        onGroupCreated(newGroup);
      }
      onClose();
    } catch (err) {
      setErrorMsg(err.message || 'Không thể tạo nhóm trò chuyện');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
      <div 
        className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl shadow-2xl border border-slate-100 dark:border-slate-800 flex flex-col max-h-[90vh] overflow-hidden animate-scaleIn"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-800 dark:text-slate-100 text-base leading-tight">{t("messages.create_group_title")}</h3>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">Trò chuyện cùng lúc với nhiều bạn bè</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition cursor-pointer"
            title="Đóng"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto flex-1 space-y-4">
          {errorMsg && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800 rounded-xl text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Tên nhóm */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              {t("messages.group_name")} <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              placeholder="Ví dụ: Hội Bạn Thân, Nhóm Đồ Án..."
              maxLength={100}
              className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100/70 dark:hover:bg-slate-750 focus:bg-white dark:focus:bg-slate-850 text-sm text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 rounded-xl border border-slate-200 dark:border-slate-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900/30 outline-none transition"
            />
          </div>

          {/* Chọn thành viên */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Thêm bạn bè vào nhóm <span className="text-rose-500">*</span>
              </label>
              <span className="text-xs font-semibold text-blue-600 dark:text-blue-400">
                Đã chọn: {selectedFriendIds.length} người
              </span>
            </div>

            {/* Tìm kiếm bạn bè */}
            <div className="relative mb-2">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={t("messages.search_friends_by_name")}
                className="w-full pl-9 pr-3.5 py-2 bg-slate-50 dark:bg-slate-800 text-xs sm:text-sm text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 rounded-xl border border-slate-200 dark:border-slate-700 focus:border-blue-500 focus:bg-white dark:focus:bg-slate-850 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900/30 outline-none transition"
              />
            </div>

            {/* Danh sách bạn bè để tích chọn */}
            <div className="max-h-56 overflow-y-auto border border-slate-100 dark:border-slate-800 rounded-xl divide-y divide-slate-50 dark:divide-slate-800">
              {isLoadingFriends ? (
                <div className="p-6 text-center text-slate-400 flex items-center justify-center gap-2 text-xs">
                  <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                  <span>Đang tải danh sách bạn bè...</span>
                </div>
              ) : filteredFriends.length === 0 ? (
                <div className="p-6 text-center text-slate-400 dark:text-slate-500 text-xs">
                  {friends.length === 0
                    ? 'Bạn chưa có bạn bè nào để tạo nhóm.'
                    : 'Không tìm thấy bạn bè phù hợp.'}
                </div>
              ) : (
                filteredFriends.map(friend => {
                  const isSelected = selectedFriendIds.includes(friend.id);
                  return (
                    <div
                      key={friend.id}
                      onClick={() => toggleSelectFriend(friend.id)}
                      className={`p-2.5 flex items-center justify-between gap-3 cursor-pointer transition select-none ${
                        isSelected ? 'bg-blue-50/80 dark:bg-blue-950/50 hover:bg-blue-50 dark:hover:bg-blue-950/60' : 'hover:bg-slate-50 dark:hover:bg-slate-800'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <img
                          src={friend.avatar}
                          alt={friend.name}
                          className="w-9 h-9 rounded-full object-cover ring-1 ring-slate-100 dark:ring-slate-750 shrink-0"
                        />
                        <div className="min-w-0">
                          <p className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-100 truncate">
                            {friend.name}
                          </p>
                          <p className="text-[11px] text-slate-400 dark:text-slate-500 truncate">
                            @{friend.username}
                          </p>
                        </div>
                      </div>

                      <div className={`w-5 h-5 rounded-md flex items-center justify-center border transition shrink-0 ${
                        isSelected 
                          ? 'bg-blue-600 border-blue-600 text-white' 
                          : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800'
                      }`}>
                        {isSelected && <Check className="w-3.5 h-3.5" />}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
            <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1.5">
              Cần chọn tối thiểu 2 người bạn để nhóm có từ 3 thành viên trở lên (bao gồm bạn).
            </p>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3.5 bg-slate-50 dark:bg-slate-950/40 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2.5 shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-800 dark:hover:text-slate-100 hover:bg-slate-200/60 dark:hover:bg-slate-800 rounded-xl transition cursor-pointer"
          >
            Hủy
          </button>
          <button
            type="button"
            onClick={handleCreateGroup}
            disabled={isSubmitting || selectedFriendIds.length < 2 || !groupName.trim()}
            className="px-4 py-2 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition shadow-xs cursor-pointer flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>{t("messages.creating_group")}</span>
              </>
            ) : (
              <>
                <Users className="w-3.5 h-3.5" />
                <span>{t("messages.create_group_btn")}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

