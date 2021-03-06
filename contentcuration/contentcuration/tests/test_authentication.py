from __future__ import absolute_import

from django.core.urlresolvers import reverse

from .base import BaseTestCase
from contentcuration.utils.policies import check_policies


class AuthenticationTestCase(BaseTestCase):

    def setUp(self):
        super(AuthenticationTestCase, self).setUp()
        self.base_url = reverse("channel", kwargs={"channel_id": self.channel.pk})

    def test_authenticate_policy_update(self):
        """
        Test that authenticated new users are shown the policies page regardless of what page was requested
        if they have policies they have not yet agreed to.
        """
        self.channel.viewers.add(self.user)
        self.client.force_login(self.user)

        assert len(check_policies(self.user)) > 0
        # ensure that a new user is redirected to policy update after authenticating the first time.
        response = self.get(self.base_url, follow=True)
        assert "/policies/update" == response.redirect_chain[-1][0]

    def test_channel_admin_access(self):
        admin_url = '/administration/'

        response = self.get(admin_url, follow=True)
        assert "/accounts/?next={}".format(admin_url) == response.redirect_chain[-1][0]
        assert response.status_code == 200

        self.sign_in()

        response = self.get(admin_url)
        assert response.status_code == 403

        self.user.is_admin = True
        self.user.save()

        response = self.get(admin_url)
        assert response.status_code == 200

    def test_unathenticated_channel_access(self):
        response = self.get(self.base_url)
        # test that it redirects
        assert response.status_code == 302

        # now test that when we are redirected we get taken to the login page since we're not signed in,
        # and that after sign in we'll get sent to the right place.
        response = self.get(self.base_url, follow=True)
        assert "/accounts/?next={}".format(self.base_url) == response.redirect_chain[-1][0]
        assert response.status_code == 200

    def test_no_rights_channel_access(self):
        self.channel.editors.remove(self.user)

        self.sign_in()

        response = self.get(self.base_url, follow=True)
        assert response.status_code == 404

    def test_view_only_channel_access(self):
        self.channel.editors.remove(self.user)

        self.sign_in()

        self.channel.viewers.add(self.user)

        response = self.get(self.base_url, follow=True)
        assert response.status_code == 200

    def test_edit_channel_access(self):
        self.sign_in()

        # we can edit!
        response = self.get(self.base_url, follow=True)
        assert response.status_code == 200
