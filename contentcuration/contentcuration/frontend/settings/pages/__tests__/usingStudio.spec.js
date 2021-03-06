import { mount } from '@vue/test-utils';
import UsingStudio from '../UsingStudio/index';

function makeWrapper() {
  return mount(UsingStudio);
}

describe('usingStudio tab', () => {
  let wrapper;
  beforeEach(() => {
    wrapper = makeWrapper();
  });

  it('clicking privacy link should open policies modal', () => {
    wrapper.find('[data-test="policy-link"]').trigger('click');
    expect(wrapper.vm.showPrivacyPolicy).toBe(true);
  });
  it('clicking privacy link should open report issue modal', () => {
    wrapper.find('[data-test="report-link"]').trigger('click');
    expect(wrapper.vm.showReportIssueForm).toBe(true);
  });
});
