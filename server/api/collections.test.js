/* eslint-disable flowtype/require-valid-file-annotation */
import TestServer from 'fetch-test-server';
import app from '../app';
import { flushdb, seed } from '../test/support';
import { buildUser, buildCollection } from '../test/factories';
import { Collection, CollectionUser } from '../models';
const server = new TestServer(app.callback());

beforeEach(flushdb);
afterAll(server.close);

describe('#collections.list', async () => {
  it('should require authentication', async () => {
    const res = await server.post('/api/collections.list');
    const body = await res.json();

    expect(res.status).toEqual(401);
    expect(body).toMatchSnapshot();
  });

  it('should return collections', async () => {
    const { user, collection } = await seed();
    const res = await server.post('/api/collections.list', {
      body: { token: user.getJwtToken() },
    });
    const body = await res.json();

    expect(res.status).toEqual(200);
    expect(body.data.length).toEqual(1);
    expect(body.data[0].id).toEqual(collection.id);
  });

  it('should not return private collections not a member of', async () => {
    const { user, collection } = await seed();
    await buildCollection({
      private: true,
      teamId: user.teamId,
    });
    const res = await server.post('/api/collections.list', {
      body: { token: user.getJwtToken() },
    });
    const body = await res.json();

    expect(res.status).toEqual(200);
    expect(body.data.length).toEqual(1);
    expect(body.data[0].id).toEqual(collection.id);
  });

  it('should return private collections member of', async () => {
    const { user } = await seed();
    await buildCollection({
      private: true,
      teamId: user.teamId,
      userId: user.id,
    });
    const res = await server.post('/api/collections.list', {
      body: { token: user.getJwtToken() },
    });
    const body = await res.json();

    expect(res.status).toEqual(200);
    expect(body.data.length).toEqual(2);
  });
});

describe('#collections.export', async () => {
  it('should require user to be a member', async () => {
    const { user } = await seed();
    const collection = await buildCollection({
      private: true,
      teamId: user.teamId,
    });
    const res = await server.post('/api/collections.export', {
      body: { token: user.getJwtToken(), id: collection.id },
    });

    expect(res.status).toEqual(403);
  });

  it('should require authentication', async () => {
    const res = await server.post('/api/collections.export');
    const body = await res.json();

    expect(res.status).toEqual(401);
    expect(body).toMatchSnapshot();
  });

  it('should return success', async () => {
    const { user, collection } = await seed();
    const res = await server.post('/api/collections.export', {
      body: { token: user.getJwtToken(), id: collection.id },
    });

    expect(res.status).toEqual(200);
  });
});

describe('#collections.exportAll', async () => {
  it('should require authentication', async () => {
    const res = await server.post('/api/collections.exportAll');
    const body = await res.json();

    expect(res.status).toEqual(401);
    expect(body).toMatchSnapshot();
  });

  it('should require authorization', async () => {
    const user = await buildUser();
    const res = await server.post('/api/collections.exportAll', {
      body: { token: user.getJwtToken() },
    });
    expect(res.status).toEqual(403);
  });

  it('should return success', async () => {
    const { admin } = await seed();
    const res = await server.post('/api/collections.exportAll', {
      body: { token: admin.getJwtToken() },
    });

    expect(res.status).toEqual(200);
  });

  it('should allow downloading directly', async () => {
    const { admin } = await seed();
    const res = await server.post('/api/collections.exportAll', {
      body: { token: admin.getJwtToken(), download: true },
    });

    expect(res.status).toEqual(200);
    expect(res.headers.get('content-type')).toEqual(
      'application/force-download'
    );
  });
});

describe('#collections.add_user', async () => {
  it('should add user to collection', async () => {
    const user = await buildUser();
    const collection = await buildCollection({
      teamId: user.teamId,
      userId: user.id,
      private: true,
    });
    const anotherUser = await buildUser({ teamId: user.teamId });
    const res = await server.post('/api/collections.add_user', {
      body: {
        token: user.getJwtToken(),
        id: collection.id,
        userId: anotherUser.id,
      },
    });

    const users = await collection.getUsers();
    expect(res.status).toEqual(200);
    expect(users.length).toEqual(2);
  });

  it('should require user in team', async () => {
    const user = await buildUser();
    const collection = await buildCollection({
      teamId: user.teamId,
      private: true,
    });
    const anotherUser = await buildUser();
    const res = await server.post('/api/collections.add_user', {
      body: {
        token: user.getJwtToken(),
        id: collection.id,
        userId: anotherUser.id,
      },
    });
    const body = await res.json();

    expect(res.status).toEqual(403);
    expect(body).toMatchSnapshot();
  });

  it('should require authentication', async () => {
    const res = await server.post('/api/collections.add_user');

    expect(res.status).toEqual(401);
  });

  it('should require authorization', async () => {
    const { collection } = await seed();
    const user = await buildUser();
    const anotherUser = await buildUser({ teamId: user.teamId });

    const res = await server.post('/api/collections.add_user', {
      body: {
        token: user.getJwtToken(),
        id: collection.id,
        userId: anotherUser.id,
      },
    });
    expect(res.status).toEqual(403);
  });
});

describe('#collections.remove_user', async () => {
  it('should remove user from collection', async () => {
    const user = await buildUser();
    const collection = await buildCollection({
      teamId: user.teamId,
      userId: user.id,
      private: true,
    });
    const anotherUser = await buildUser({ teamId: user.teamId });

    await server.post('/api/collections.add_user', {
      body: {
        token: user.getJwtToken(),
        id: collection.id,
        userId: anotherUser.id,
      },
    });

    const res = await server.post('/api/collections.remove_user', {
      body: {
        token: user.getJwtToken(),
        id: collection.id,
        userId: anotherUser.id,
      },
    });

    const users = await collection.getUsers();
    expect(res.status).toEqual(200);
    expect(users.length).toEqual(1);
  });

  it('should require user in team', async () => {
    const user = await buildUser();
    const collection = await buildCollection({
      teamId: user.teamId,
      private: true,
    });
    const anotherUser = await buildUser();
    const res = await server.post('/api/collections.remove_user', {
      body: {
        token: user.getJwtToken(),
        id: collection.id,
        userId: anotherUser.id,
      },
    });
    const body = await res.json();

    expect(res.status).toEqual(403);
    expect(body).toMatchSnapshot();
  });

  it('should require authentication', async () => {
    const res = await server.post('/api/collections.remove_user');

    expect(res.status).toEqual(401);
  });

  it('should require authorization', async () => {
    const { collection } = await seed();
    const user = await buildUser();
    const anotherUser = await buildUser({ teamId: user.teamId });

    const res = await server.post('/api/collections.remove_user', {
      body: {
        token: user.getJwtToken(),
        id: collection.id,
        userId: anotherUser.id,
      },
    });
    expect(res.status).toEqual(403);
  });
});

describe('#collections.users', async () => {
  it('should return users in private collection', async () => {
    const { collection, user } = await seed();
    await CollectionUser.create({
      createdById: user.id,
      collectionId: collection.id,
      userId: user.id,
      permission: 'read_write',
    });

    const res = await server.post('/api/collections.users', {
      body: { token: user.getJwtToken(), id: collection.id },
    });
    const body = await res.json();

    expect(res.status).toEqual(200);
    expect(body.data.length).toEqual(1);
  });

  it('should require authentication', async () => {
    const res = await server.post('/api/collections.users');
    const body = await res.json();

    expect(res.status).toEqual(401);
    expect(body).toMatchSnapshot();
  });

  it('should require authorization', async () => {
    const { collection } = await seed();
    const user = await buildUser();
    const res = await server.post('/api/collections.users', {
      body: { token: user.getJwtToken(), id: collection.id },
    });
    expect(res.status).toEqual(403);
  });
});

describe('#collections.memberships', async () => {
  it('should return members in private collection', async () => {
    const { collection, user } = await seed();
    await CollectionUser.create({
      createdById: user.id,
      collectionId: collection.id,
      userId: user.id,
      permission: 'read_write',
    });

    const res = await server.post('/api/collections.memberships', {
      body: { token: user.getJwtToken(), id: collection.id },
    });
    const body = await res.json();

    expect(res.status).toEqual(200);
    expect(body.data.users.length).toEqual(1);
    expect(body.data.users[0].id).toEqual(user.id);
    expect(body.data.memberships.length).toEqual(1);
    expect(body.data.memberships[0].permission).toEqual('read_write');
  });

  it('should allow filtering members in collection by name', async () => {
    const { collection, user } = await seed();
    const user2 = await buildUser({ name: "Won't find" });
    await CollectionUser.create({
      createdById: user.id,
      collectionId: collection.id,
      userId: user.id,
      permission: 'read_write',
    });
    await CollectionUser.create({
      createdById: user2.id,
      collectionId: collection.id,
      userId: user2.id,
      permission: 'read_write',
    });

    const res = await server.post('/api/collections.memberships', {
      body: {
        token: user.getJwtToken(),
        id: collection.id,
        query: user.name.slice(0, 3),
      },
    });
    const body = await res.json();

    expect(res.status).toEqual(200);
    expect(body.data.users.length).toEqual(1);
    expect(body.data.users[0].id).toEqual(user.id);
  });

  it('should allow filtering members in collection by permission', async () => {
    const { collection, user } = await seed();
    const user2 = await buildUser();
    await CollectionUser.create({
      createdById: user.id,
      collectionId: collection.id,
      userId: user.id,
      permission: 'read_write',
    });
    await CollectionUser.create({
      createdById: user2.id,
      collectionId: collection.id,
      userId: user2.id,
      permission: 'maintainer',
    });

    const res = await server.post('/api/collections.memberships', {
      body: {
        token: user.getJwtToken(),
        id: collection.id,
        permission: 'maintainer',
      },
    });
    const body = await res.json();

    expect(res.status).toEqual(200);
    expect(body.data.users.length).toEqual(1);
    expect(body.data.users[0].id).toEqual(user2.id);
  });

  it('should require authentication', async () => {
    const res = await server.post('/api/collections.memberships');
    const body = await res.json();

    expect(res.status).toEqual(401);
    expect(body).toMatchSnapshot();
  });

  it('should require authorization', async () => {
    const { collection } = await seed();
    const user = await buildUser();
    const res = await server.post('/api/collections.memberships', {
      body: { token: user.getJwtToken(), id: collection.id },
    });
    expect(res.status).toEqual(403);
  });
});

describe('#collections.info', async () => {
  it('should return collection', async () => {
    const { user, collection } = await seed();
    const res = await server.post('/api/collections.info', {
      body: { token: user.getJwtToken(), id: collection.id },
    });
    const body = await res.json();

    expect(res.status).toEqual(200);
    expect(body.data.id).toEqual(collection.id);
  });

  it('should require user member of collection', async () => {
    const { user, collection } = await seed();
    collection.private = true;
    await collection.save();

    const res = await server.post('/api/collections.info', {
      body: { token: user.getJwtToken(), id: collection.id },
    });
    expect(res.status).toEqual(403);
  });

  it('should require authentication', async () => {
    const res = await server.post('/api/collections.info');
    const body = await res.json();

    expect(res.status).toEqual(401);
    expect(body).toMatchSnapshot();
  });

  it('should require authorization', async () => {
    const { collection } = await seed();
    const user = await buildUser();
    const res = await server.post('/api/collections.info', {
      body: { token: user.getJwtToken(), id: collection.id },
    });
    expect(res.status).toEqual(403);
  });
});

describe('#collections.create', async () => {
  it('should require authentication', async () => {
    const res = await server.post('/api/collections.create');
    const body = await res.json();

    expect(res.status).toEqual(401);
    expect(body).toMatchSnapshot();
  });

  it('should create collection', async () => {
    const { user } = await seed();
    const res = await server.post('/api/collections.create', {
      body: { token: user.getJwtToken(), name: 'Test', type: 'atlas' },
    });
    const body = await res.json();

    expect(res.status).toEqual(200);
    expect(body.data.id).toBeTruthy();
    expect(body.data.name).toBe('Test');
    expect(body.policies.length).toBe(1);
  });
});

describe('#collections.update', async () => {
  it('should require authentication', async () => {
    const collection = await buildCollection();
    const res = await server.post('/api/collections.update', {
      body: { id: collection.id, name: 'Test' },
    });
    const body = await res.json();

    expect(res.status).toEqual(401);
    expect(body).toMatchSnapshot();
  });

  it('allows editing non-private collection', async () => {
    const { user, collection } = await seed();
    const res = await server.post('/api/collections.update', {
      body: { token: user.getJwtToken(), id: collection.id, name: 'Test' },
    });
    const body = await res.json();
    expect(res.status).toEqual(200);
    expect(body.data.name).toBe('Test');
    expect(body.policies.length).toBe(1);
  });

  it('allows editing from non-private to private collection', async () => {
    const { user, collection } = await seed();
    const res = await server.post('/api/collections.update', {
      body: {
        token: user.getJwtToken(),
        id: collection.id,
        private: true,
        name: 'Test',
      },
    });
    const body = await res.json();
    expect(res.status).toEqual(200);
    expect(body.data.name).toBe('Test');
    expect(body.data.private).toBe(true);

    // ensure we return with a write level policy
    expect(body.policies.length).toBe(1);
    expect(body.policies[0].abilities.update).toBe(true);
  });

  it('allows editing by read-write collection user', async () => {
    const { user, collection } = await seed();
    collection.private = true;
    await collection.save();

    await CollectionUser.create({
      collectionId: collection.id,
      userId: user.id,
      createdById: user.id,
      permission: 'read_write',
    });

    const res = await server.post('/api/collections.update', {
      body: { token: user.getJwtToken(), id: collection.id, name: 'Test' },
    });
    const body = await res.json();
    expect(res.status).toEqual(200);
    expect(body.data.name).toBe('Test');
    expect(body.policies.length).toBe(1);
  });

  it('does not allow editing by read-only collection user', async () => {
    const { user, collection } = await seed();
    collection.private = true;
    await collection.save();

    await CollectionUser.create({
      collectionId: collection.id,
      userId: user.id,
      createdById: user.id,
      permission: 'read',
    });

    const res = await server.post('/api/collections.update', {
      body: { token: user.getJwtToken(), id: collection.id, name: 'Test' },
    });
    expect(res.status).toEqual(403);
  });
});

describe('#collections.delete', async () => {
  it('should require authentication', async () => {
    const res = await server.post('/api/collections.delete');
    const body = await res.json();

    expect(res.status).toEqual(401);
    expect(body).toMatchSnapshot();
  });

  it('should require authorization', async () => {
    const { collection } = await seed();
    const user = await buildUser();
    const res = await server.post('/api/collections.delete', {
      body: { token: user.getJwtToken(), id: collection.id },
    });
    expect(res.status).toEqual(403);
  });

  it('should not delete last collection', async () => {
    const { user, collection } = await seed();
    const res = await server.post('/api/collections.delete', {
      body: { token: user.getJwtToken(), id: collection.id },
    });
    expect(res.status).toEqual(400);
  });

  it('should delete collection', async () => {
    const { user, collection } = await seed();
    await Collection.create({
      name: 'Blah',
      urlId: 'blah',
      teamId: user.teamId,
      creatorId: user.id,
      type: 'atlas',
    });

    const res = await server.post('/api/collections.delete', {
      body: { token: user.getJwtToken(), id: collection.id },
    });
    const body = await res.json();

    expect(res.status).toEqual(200);
    expect(body.success).toBe(true);
  });
});
