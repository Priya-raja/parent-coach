import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import Module from 'node:module';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const filename = fileURLToPath(new URL('../lib/safety.ts', import.meta.url));
const compiled = new Module(filename);
compiled._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText, filename);
const { isCrisis } = compiled.exports;

test('ordinary cutting, hit, hurt, and kill references do not trigger the gate', () => {
  for (const text of [
    'my child like cutting paper',
    'My child likes CUTTING PAPER with safety scissors.',
    'We are cutting vegetables together.',
    'He hit a ball in the garden.',
    'Her feelings were hurt.',
    'How do I kill time while waiting?',
    'We are cutting myselfish shapes.',
  ]) assert.equal(isCrisis(text), false, text);
});

test('explicit English self-harm phrases still trigger the gate', () => {
  for (const phrase of [
    'cutting myself', 'cutting themself', 'cutting himself', 'cutting herself',
    'self harm', 'self-harm', 'hurt myself', 'kill myself', 'kill himself',
    'kill herself', 'kill themself', 'suicide', 'overdose', 'want to die',
  ]) assert.equal(isCrisis(`I am worried about ${phrase.toUpperCase()}.`), true, phrase);
});

test('existing abuse and emergency phrases still trigger the gate', () => {
  for (const phrase of ['abusing', 'abused', 'beaten', 'beating', 'hit me', 'hits me', 'emergency', 'in danger', 'unsafe', 'violence']) {
    assert.equal(isCrisis(`Someone is ${phrase}.`), true, phrase);
  }
});

test('Urdu and Roman Urdu crisis phrases remain supported', () => {
  for (const phrase of [
    'خودکشی', 'زندگی ختم', 'خود کو نقصان', 'مارتا ہے', 'مارتی ہے', 'تشدد', 'خطرے میں', 'ایمرجنسی',
    'khudkhushi', 'zindagi khatam', 'khud ko nuqsan', 'maar peet', 'maarta hai', 'maarti hai', 'tashaddud', 'khatre mein',
  ]) assert.equal(isCrisis(phrase), true, phrase);
});
