import test from 'node:test';
import assert from 'node:assert/strict';

test('Group Chat: client validation rejects empty group name', () => {
  const validateGroupCreation = (name, selectedMembers) => {
    if (!name || !name.trim()) {
      return { valid: false, error: 'Vui lòng nhập tên nhóm' };
    }
    if (!selectedMembers || selectedMembers.length < 2) {
      return { valid: false, error: 'Vui lòng chọn ít nhất 2 bạn bè để tạo nhóm' };
    }
    return { valid: true };
  };

  assert.deepEqual(validateGroupCreation('', ['user-1', 'user-2']), {
    valid: false,
    error: 'Vui lòng nhập tên nhóm'
  });
  assert.deepEqual(validateGroupCreation('   ', ['user-1', 'user-2']), {
    valid: false,
    error: 'Vui lòng nhập tên nhóm'
  });
});

test('Group Chat: client validation requires at least 2 members selected', () => {
  const validateGroupCreation = (name, selectedMembers) => {
    if (!name || !name.trim()) {
      return { valid: false, error: 'Vui lòng nhập tên nhóm' };
    }
    if (!selectedMembers || selectedMembers.length < 2) {
      return { valid: false, error: 'Vui lòng chọn ít nhất 2 bạn bè để tạo nhóm' };
    }
    return { valid: true };
  };

  assert.deepEqual(validateGroupCreation('Nhóm 1 bạn', ['user-1']), {
    valid: false,
    error: 'Vui lòng chọn ít nhất 2 bạn bè để tạo nhóm'
  });
  assert.deepEqual(validateGroupCreation('Nhóm Đồ Án', ['user-1', 'user-2']), {
    valid: true
  });
  assert.deepEqual(validateGroupCreation('Nhóm Bạn Bè', ['user-1', 'user-2', 'user-3']), {
    valid: true
  });
});

test('Group Chat: conversations list search matches group name', () => {
  const conversations = [
    { id: '1', type: 'direct', user: { name: 'Alice Nguyen', username: 'alice' } },
    { id: '2', type: 'group', name: 'Nhóm Bạn Thân Đại Học', user: null },
    { id: '3', type: 'direct', user: { name: 'Bob Tran', username: 'bob' } },
    { id: '4', type: 'group', name: 'Dự Án Tốt Nghiệp', user: null },
  ];

  const filterConversations = (list, search) => {
    const term = (search || '').toLowerCase();
    return list.filter(c => {
      const name = c.type === 'group' ? (c.name || '') : (c.user?.name || '');
      const username = c.type === 'group' ? '' : (c.user?.username || '');
      return name.toLowerCase().includes(term) || username.toLowerCase().includes(term);
    });
  };

  const searchDaiHoc = filterConversations(conversations, 'Đại Học');
  assert.equal(searchDaiHoc.length, 1);
  assert.equal(searchDaiHoc[0].id, '2');

  const searchAlice = filterConversations(conversations, 'alice');
  assert.equal(searchAlice.length, 1);
  assert.equal(searchAlice[0].id, '1');

  const searchTotNghiep = filterConversations(conversations, 'tốt nghiệp');
  assert.equal(searchTotNghiep.length, 1);
  assert.equal(searchTotNghiep[0].id, '4');
});

test('Group Chat: groups are always present in main inbox and excluded from requests tab', () => {
  const currentUserId = 'user-current';
  const conversations = [
    { id: '1', type: 'direct', status: 'pending', initiatedBy: 'user-other' }, // Request
    { id: '2', type: 'direct', status: 'accepted', initiatedBy: 'user-current' }, // Main
    { id: '3', type: 'group', status: 'accepted', initiatedBy: 'user-other' }, // Main group
    { id: '4', type: 'group', status: 'accepted', initiatedBy: 'user-current' }, // Main group
  ];

  const getDisplayed = (list, tab) => {
    return list.filter(c => {
      const isPendingForMe = c.status === 'pending' && c.initiatedBy !== currentUserId && c.type !== 'group';
      return tab === 'requests' ? isPendingForMe : !isPendingForMe;
    });
  };

  const mainList = getDisplayed(conversations, 'main');
  assert.equal(mainList.length, 3);
  assert.ok(mainList.some(c => c.id === '3'));
  assert.ok(mainList.some(c => c.id === '4'));

  const requestsList = getDisplayed(conversations, 'requests');
  assert.equal(requestsList.length, 1);
  assert.equal(requestsList[0].id, '1');
});

test('Group Chat: format group messages and identify system messages', () => {
  const rawMessages = [
    {
      id: 101,
      sender_id: 'user-1',
      sender_name: 'Alice Nguyen',
      sender_avatar: 'https://example.com/alice.png',
      content: 'Alice Nguyen đã tạo nhóm "Nhóm Học Tập"',
      media_type: 'system',
      created_at: '2026-11-05T12:00:00Z'
    },
    {
      id: 102,
      sender_id: 'user-2',
      sender_name: 'Bob Tran',
      sender_avatar: 'https://example.com/bob.png',
      content: 'Chào cả nhóm!',
      media_type: 'text',
      created_at: '2026-11-05T12:01:00Z'
    }
  ];

  const formatted = rawMessages.map(m => ({
    id: m.id,
    isSystem: m.media_type === 'system',
    senderName: m.sender_name,
    senderAvatar: m.sender_avatar,
    content: m.content
  }));

  assert.equal(formatted[0].isSystem, true);
  assert.equal(formatted[0].content, 'Alice Nguyen đã tạo nhóm "Nhóm Học Tập"');
  assert.equal(formatted[1].isSystem, false);
  assert.equal(formatted[1].senderName, 'Bob Tran');
});

test('Group Chat: group name update validation', () => {
  const validateGroupNameUpdate = (name) => {
    const trimmed = (name || '').trim();
    if (!trimmed) {
      return { valid: false, error: 'Tên nhóm không được để trống' };
    }
    if (trimmed.length > 100) {
      return { valid: false, error: 'Tên nhóm không được vượt quá 100 ký tự' };
    }
    return { valid: true, name: trimmed };
  };

  assert.deepEqual(validateGroupNameUpdate(''), {
    valid: false,
    error: 'Tên nhóm không được để trống'
  });
  assert.deepEqual(validateGroupNameUpdate('   '), {
    valid: false,
    error: 'Tên nhóm không được để trống'
  });
  assert.deepEqual(validateGroupNameUpdate(null), {
    valid: false,
    error: 'Tên nhóm không được để trống'
  });
  assert.deepEqual(validateGroupNameUpdate('Nhóm Dự Án Mới'), {
    valid: true,
    name: 'Nhóm Dự Án Mới'
  });
});

test('Group Chat: group avatar validation enforces image type and 5MB size limit', () => {
  const validateGroupAvatarFile = (file) => {
    if (!file || !file.type || !file.type.startsWith('image/')) {
      return { valid: false, error: 'Vui lòng chọn tệp hình ảnh hợp lệ (PNG, JPG, WebP, GIF)' };
    }
    if (file.size > 5 * 1024 * 1024) {
      return { valid: false, error: 'Dung lượng ảnh tối đa là 5MB' };
    }
    return { valid: true };
  };

  assert.deepEqual(validateGroupAvatarFile({ type: 'application/pdf', size: 1024 }), {
    valid: false,
    error: 'Vui lòng chọn tệp hình ảnh hợp lệ (PNG, JPG, WebP, GIF)'
  });
  assert.deepEqual(validateGroupAvatarFile({ type: 'image/jpeg', size: 6 * 1024 * 1024 }), {
    valid: false,
    error: 'Dung lượng ảnh tối đa là 5MB'
  });
  assert.deepEqual(validateGroupAvatarFile({ type: 'image/png', size: 2 * 1024 * 1024 }), {
    valid: true
  });
});

test('Group Chat: GROUP_UPDATED event updates conversation and user sub-object in state', () => {
  const prevConversations = [
    {
      id: '32',
      type: 'group',
      name: 'Nhóm Cũ',
      avatar: null,
      memberCount: 3,
      user: { id: 'group_32', name: 'Nhóm Cũ', avatar: 'default.png' }
    },
    {
      id: '33',
      type: 'direct',
      name: null,
      avatar: null,
      user: { id: 'user_2', name: 'Bob', avatar: 'bob.png' }
    }
  ];

  const updateEvent = {
    type: 'GROUP_UPDATED',
    conversation_id: 32,
    conversation: {
      id: 32,
      name: 'Nhóm Siêu Cấp Vip',
      avatar: 'https://example.com/new-avatar.png',
      member_count: 4
    }
  };

  const updatedGroup = updateEvent.conversation;
  const convIdStr = String(updateEvent.conversation_id);
  const nextConversations = prevConversations.map(c => {
    if (String(c.id) === convIdStr) {
      const newName = updatedGroup.name || c.name;
      const newAvatar = updatedGroup.avatar !== undefined ? updatedGroup.avatar : c.avatar;
      return {
        ...c,
        name: newName,
        avatar: newAvatar,
        memberCount: updatedGroup.member_count !== undefined ? updatedGroup.member_count : c.memberCount,
        user: {
          ...c.user,
          name: newName || c.user?.name,
          avatar: newAvatar || c.user?.avatar
        }
      };
    }
    return c;
  });

  const updatedTarget = nextConversations.find(c => c.id === '32');
  assert.equal(updatedTarget.name, 'Nhóm Siêu Cấp Vip');
  assert.equal(updatedTarget.avatar, 'https://example.com/new-avatar.png');
  assert.equal(updatedTarget.memberCount, 4);
  assert.equal(updatedTarget.user.name, 'Nhóm Siêu Cấp Vip');
  assert.equal(updatedTarget.user.avatar, 'https://example.com/new-avatar.png');

  // Verify non-target was not modified
  assert.equal(nextConversations.find(c => c.id === '33').user.name, 'Bob');
});


