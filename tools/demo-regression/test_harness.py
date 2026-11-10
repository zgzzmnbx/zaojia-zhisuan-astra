"""Negative checks: missing evidence or stale versions must never turn green."""
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
import run
from common import Results, sha, write

class HarnessTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory()
        self.out=Path(self.temp.name)
    def tearDown(self):self.temp.cleanup()
    def populate(self,manual=True):
        for layer in ['api','browser','manual']:
            write(self.out/f'{layer}-results.json',[{'id':c['id'],'layer':layer,'status':'passed','detail':'self-test fixture'}
                 for c in run.CASES if layer in c['layers'] and (manual or layer!='manual')])
    def test_empty_is_incomplete(self):
        self.assertEqual(run.render(self.out)['status'],'incomplete')
    def test_auto_only_is_not_all_accepted(self):
        self.populate(False)
        report=run.render(self.out)
        self.assertEqual(report['status'],'incomplete')
        self.assertEqual(report['counts'],{'passed':24,'failed':0,'not_run':6})
    def test_missing_required_layer_is_not_pass(self):
        self.populate()
        (self.out/'api-results.json').unlink()
        self.assertNotEqual(run.render(self.out)['status'],'passed')
    def test_business_assertion_failure_survives_summary(self):
        self.populate()
        checks=Results(self.out,'api')
        def wrong_price():self.assertEqual(500000,50000)
        checks.check('D03',wrong_price)
        self.assertEqual(run.render(self.out)['status'],'failed')
    def test_runner_failure_not_hidden_by_case_passes(self):
        self.populate()
        write(self.out/'gates.json',{'browser':{'exit_code':124}})
        self.assertEqual(run.render(self.out)['status'],'failed')
    def test_missing_execution_gate_cannot_pass(self):
        self.populate()
        self.assertEqual(run.render(self.out)['status'],'incomplete')
    def test_complete_evidence_can_pass(self):
        self.populate()
        write(self.out/'gates.json',{k:{'exit_code':0} for k in ['harness','api','contracts','browser','formal_preserved','module_isolation']})
        self.assertEqual(run.render(self.out)['status'],'passed')
    def test_stale_formal_rejects_manual_acceptance(self):
        source=self.out/'app.py';source.write_text('before')
        manifest={'source_hashes':{'app.py':sha(source)}}
        with patch.object(run,'FORMAL',self.out):
            run.ensure_same_version(manifest)
            source.write_text('after')
            with self.assertRaisesRegex(ValueError,'Version changed'):run.ensure_same_version(manifest)

if __name__=='__main__':unittest.main()
