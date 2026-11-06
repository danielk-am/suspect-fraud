import test from 'node:test';
import assert from 'node:assert/strict';
import {resolveNavigation} from '../src/scripts/navigation.mjs';

test('private destinations require unlock and then a selected case', () => {
  for (const section of ['evidence', 'infrastructure', 'reporting', 'learning']) {
    assert.equal(resolveNavigation(section, false, false).target, 'unlock');
    assert.equal(resolveNavigation(section, true, false).target, 'new-case');
    assert.equal(resolveNavigation(section, true, true).target, section);
    assert.match(resolveNavigation(section, false, false).message, /Unlock/);
    assert.match(resolveNavigation(section, true, false).message, /Create or open/);
  }
});

test('new investigation opens the case form after unlock; unknown hashes are ignored', () => {
  assert.equal(resolveNavigation('start', false, false).target, 'unlock');
  assert.equal(resolveNavigation('start', true, true).target, 'new-case');
  assert.equal(resolveNavigation('new-case', false, false).target, 'unlock');
  assert.equal(resolveNavigation('unlock', true, false).target, 'new-case');
  assert.equal(resolveNavigation('not-a-section', true, true), null);
});
