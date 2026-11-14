import { useState, useEffect } from 'react';
import { X, Search, UserPlus, Check, Loader2, AlertCircle } from 'lucide-react';
import { friendService } from '../services/friendService';
import { messageService } from '../services/messageService';
import { DEFAULT_AVATAR } from '../constants/defaults';
import { useTranslation } from '../utils/i18n';

export default function AddGroupMemberModal({ isOpen, onClose, conversation, onMembersAdded, currentUser }) {
  const { t } = useTranslation();
  const [friends, setFriends] = useState([]);
  const [selectedFriendIds, setSelectedFriendIds] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoadingFriends, setIsLoadingFriends] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (!isOpen) {
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

  if (!isOpen || !conversation) return null;

  const existingMemberIds = new Set(
    (conversation.members || []).map(m => String(m.id))
  );

  // Chỉ hiển thị bạn bè chưa có trong nhóm
  const availableFriends = friends.filter(f => !existingMemberIds.has(String(f.id)));

  const toggleSelectFriend = (id) => {
    setSelectedFriendIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const filteredFriends = availableFriends.filter(f => {
    const term = searchTerm.toLowerCase();
    return f.name.toLowerCase().includes(term) || f.username.toLowerCase().includes(term);
  });

  const handleAddMembers = async (e) => {
    e?.preventDefault();
    if (selectedFriendIds.length === 0) {
      setErrorMsg('Vui lòng chọn ít nhất một người bạn để thêm vào nhóm');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg('');

    try {
      const updatedGroup = await messageService.addMembersToGroup(conversation.id, selectedFriendIds);
      if (onMembersAdded) {
        onMembersAdded(updatedGroup);
      }
      onClose();
    } catch (err) {
      setErrorMsg(err.message || 'Không thể thêm thành viên vào nhóm');
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
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-blue-50 dark:bg-blue-950/60 flex items-center justify-center text-blue-600 dark:text-blue-400">
              <UserPlus className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-800 dark:text-slate-100">
                Thêm thành viên vào nhóm
              </h2>
              <p className="text-xs text-slate-400 truncate max-w-[260px] sm:max-w-xs">
                {conversation.name || 'Nhóm trò chuyện'} • {conversation.memberCount || conversation.members?.length || 0} thành viên hiện tại
              </p>
            </div>
          </div>
          <button 
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Thông báo lỗi */}
        {errorMsg && (
          <div className="mx-6 mt-4 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900/50 text-rose-600 dark:text-rose-400 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Nội dung danh sách chọn bạn bè */}
        <div className="p-6 space-y-4 flex-1 overflow-y-auto">
          {/* Ô tìm kiếm bạn bè */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Tìm kiếm bạn bè theo tên..."
              className="w-full pl-10 pr-4 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-hidden focus:border-blue-500 text-slate-800 dark:text-slate-100 placeholder-slate-400"
            />
          </div>

          {/* Badge người đã chọn */}
          {selectedFriendIds.length > 0 && (
            <div className="flex flex-wrap gap-1.5 p-2 bg-blue-50/50 dark:bg-blue-950/30 rounded-xl border border-blue-100 dark:border-blue-900/40">
              {selectedFriendIds.map(id => {
                const friend = friends.find(f => f.id === id);
                if (!friend) return null;
                return (
                  <span 
                    key={id} 
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white dark:bg-slate-800 border border-blue-200 dark:border-blue-800 rounded-lg text-xs font-semibold text-blue-600 dark:text-blue-400 shadow-2xs"
                  >
                    <img src={friend.avatar} alt="" className="w-4 h-4 rounded-full object-cover" />
                    <span>{friend.name}</span>
                    <button 
                      type="button" 
                      onClick={() => toggleSelectFriend(id)}
                      className="hover:text-rose-500 cursor-pointer"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                );
              })}
            </div>
          )}

          {/* Danh sách bạn bè có thể thêm */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
              <span>Bạn bè ({availableFriends.length})</span>
              <span>Đã chọn: {selectedFriendIds.length}</span>
            </div>

            {isLoadingFriends ? (
              <div className="py-8 flex flex-col items-center justify-center gap-2 text-slate-400">
                <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
                <span className="text-xs">Đang tải danh sách bạn bè...</span>
              </div>
            ) : availableFriends.length === 0 ? (
              <div className="py-8 text-center text-slate-400 text-xs">
                {friends.length === 0 
                  ? 'Bạn chưa có bạn bè nào để thêm vào nhóm.' 
                  : 'Tất cả bạn bè của bạn đã là thành viên trong nhóm này.'}
              </div>
            ) : filteredFriends.length === 0 ? (
              <div className="py-6 text-center text-slate-400 text-xs">
                Không tìm thấy bạn bè phù hợp với "{searchTerm}"
              </div>
            ) : (
              <div className="space-y-1 max-h-60 overflow-y-auto pr-1">
                {filteredFriends.map(friend => {
                  const isSelected = selectedFriendIds.includes(friend.id);
                  return (
                    <div 
                      key={friend.id}
                      onClick={() => toggleSelectFriend(friend.id)}
                      className={`flex items-center justify-between p-2.5 rounded-xl cursor-pointer transition ${
                        isSelected 
                          ? 'bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800' 
                          : 'hover:bg-slate-50 dark:hover:bg-slate-800 border border-transparent'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <img 
                          src={friend.avatar} 
                          alt={friend.name} 
                          className="w-9 h-9 rounded-full object-cover shrink-0 ring-1 ring-slate-100 dark:ring-slate-800"
                        />
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate">
                            {friend.name}
                          </p>
                          <p className="text-[11px] text-slate-400 truncate">
                            @{friend.username}
                          </p>
                        </div>
                      </div>

                      <div className={`w-5 h-5 rounded-full flex items-center justify-center transition border ${
                        isSelected 
                          ? 'bg-blue-600 border-blue-600 text-white' 
                          : 'border-slate-300 dark:border-slate-600'
                      }`}>
                        {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2.5 px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/20">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition cursor-pointer"
          >
            Hủy
          </button>
          <button
            type="button"
            onClick={handleAddMembers}
            disabled={isSubmitting || selectedFriendIds.length === 0}
            className="px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl transition shadow-md shadow-blue-500/20 flex items-center gap-2 cursor-pointer"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Đang thêm...</span>
              </>
            ) : (
              <span>Thêm vào nhóm ({selectedFriendIds.length})</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
