import channelList from '../index';
import { Channel, Invitation } from 'shared/data/resources';
import storeFactory from 'shared/vuex/baseStore';
import { track } from 'shared/analytics/tracker';

jest.mock('shared/client');
jest.mock('shared/analytics/tracker');

jest.mock('shared/vuex/connectionPlugin');

const channel_id = '11111111111111111111111111111111';
const userId = 'testId';
const invitation = {
  channel: channel_id,
  invited: userId,
  share_mode: 'view',
};

describe('invitation actions', () => {
  let store;
  let id;
  beforeEach(() => {
    return Invitation.put(invitation).then(newId => {
      id = newId;
      store = storeFactory({
        modules: {
          channelList,
        },
      });
      store.state.session.currentUser.id = userId;
      store.state.session.loggedIn = true;
    });
  });
  afterEach(() => {
    return Invitation.table.toCollection().delete();
  });

  describe('loadInvitationList action', () => {
    it('should call Invitation.where', () => {
      const whereSpy = jest.spyOn(Invitation, 'where');
      return store.dispatch('channelList/loadInvitationList').then(() => {
        expect(whereSpy).toHaveBeenCalled();
        whereSpy.mockRestore();
      });
    });
    it('should set the returned data to the invitations', () => {
      return store.dispatch('channelList/loadInvitationList').then(() => {
        expect(store.getters['channelList/invitations']).toEqual([
          {
            id,
            ...invitation,
            accepted: false,
            declined: false,
          },
        ]);
      });
    });
  });
  describe('acceptInvitation action', () => {
    const channel = { id: channel_id, name: 'test', deleted: false, edit: true };
    beforeEach(() => {
      store.commit('channelList/SET_INVITATION_LIST', [{ id, ...invitation }]);
      return Channel.put(channel);
    });
    afterEach(() => {
      return Channel.table.toCollection().delete();
    });
    it('should call update with accepted as true', () => {
      const updateSpy = jest.spyOn(Invitation, 'update');
      return store.dispatch('channelList/acceptInvitation', id).then(() => {
        expect(updateSpy).toHaveBeenCalled();
        expect(updateSpy.mock.calls[0][0]).toBe(id);
        expect(updateSpy.mock.calls[0][1]).toEqual({ accepted: true });
        updateSpy.mockRestore();
      });
    });
    it('should load and set the invited channel', () => {
      return store.dispatch('channelList/acceptInvitation', id).then(() => {
        expect(store.getters['channel/getChannel'](channel_id).id).toBeTruthy();
      });
    });
    it('should  remove the invitation from the list', () => {
      return store.dispatch('channelList/acceptInvitation', id).then(() => {
        expect(store.getters['channelList/getInvitation'](id)).toBeFalsy();
      });
    });
    it('should set the correct permission on the accepted invite', () => {
      return store.dispatch('channelList/acceptInvitation', id).then(() => {
        expect(store.getters['channel/getChannel'](channel_id).view).toBe(true);
        expect(store.getters['channel/getChannel'](channel_id).edit).toBe(false);
      });
    });
  });
  describe('declineInvitation action', () => {
    beforeEach(() => {
      store.commit('channelList/SET_INVITATION_LIST', [{ id, ...invitation }]);
    });
    it('should call client.delete', () => {
      const updateSpy = jest.spyOn(Invitation, 'update');
      return store.dispatch('channelList/declineInvitation', id).then(() => {
        expect(updateSpy).toHaveBeenCalled();
        expect(updateSpy.mock.calls[0][0]).toBe(id);
        expect(updateSpy.mock.calls[0][1]).toEqual({ declined: true });
        updateSpy.mockRestore();
      });
    });
    it('should not load and set the invited channel', () => {
      return store.dispatch('channelList/declineInvitation', id).then(() => {
        expect(store.getters['channel/getChannel'](channel_id)).toBeUndefined();
      });
    });
    it('should remove the invitation from the list', () => {
      return store.dispatch('channelList/declineInvitation', id).then(() => {
        expect(store.getters['channelList/getInvitation'](id)).toBeFalsy();
      });
    });
  });
});

describe('searchCatalog action', () => {
  let store;
  const searchCatalog = jest.fn();
  beforeEach(() => {
    searchCatalog.mockReset();
    Channel.searchCatalog = data => {
      return new Promise(resolve => {
        searchCatalog(data);
        resolve({ results: [] });
      });
    };
    store = storeFactory({
      modules: {
        channelList,
      },
    });
    store.state.session.loggedIn = false;
  });
  it('should call Channel.searchCatalog if user is not logged in', () => {
    return store.dispatch('channelList/searchCatalog', {}).then(() => {
      expect(searchCatalog).toHaveBeenCalled();
    });
  });
  it('should only look for public and published channels', () => {
    return store.dispatch('channelList/searchCatalog', {}).then(() => {
      expect(searchCatalog.mock.calls[0][0].public).toBe(true);
      expect(searchCatalog.mock.calls[0][0].published).toBe(true);
      expect(searchCatalog.mock.calls[0][0].page_size).toBeTruthy();
    });
  });
  it('should use query params in query filter', () => {
    return store.dispatch('channelList/searchCatalog', { keywords: 'testing' }).then(() => {
      expect(searchCatalog.mock.calls[0][0].keywords).toBe('testing');
    });
  });
  it('should log the analytics event', () => {
    track.mockReset();
    return store.dispatch('channelList/searchCatalog', { keywords: 'test tracking' }).then(() => {
      expect(track).toHaveBeenCalled();
      expect(track.mock.calls[0][1]).toBe('keywords=test tracking');
    });
  });
});
