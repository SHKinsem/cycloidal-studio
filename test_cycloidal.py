# -*- coding: utf-8 -*-
# 运行: python test_cycloidal.py   (无pytest依赖, assert式自检)
import numpy as np
import CycloidalModAnalysis as m

def test_conjugate():
    """无修型齿廓必须与19针全部同时接触(共轭性, 管线正确性基线)"""
    X, Y = m.profile(0, 0, 'none')
    for psi in (0.0, 0.3, 1.1):
        gaps, _, _ = m.mesh_state(X, Y, psi, m.ROT_SIGN)
        assert np.abs(gaps).max() < 5e-4, f"psi={psi}: {np.abs(gaps).max()}"

def test_harmonic_uniform():
    """s1=s2=0 即纯等距修型: 法向间隙处处= |offset| (偏置曲线性质, 精确)"""
    X, Y = m.profile(-0.030, 0.0, 'harmonic')
    gaps, _, _ = m.mesh_state(X, Y, 0.0, m.ROT_SIGN)
    assert np.abs(gaps - 0.030).max() < 1e-3, f"max dev {np.abs(gaps-0.030).max()*1e3:.2f} um"

def test_harmonic_midflank():
    """s2<0 应把最紧点放到齿腰 u≈0.25/0.75 (紧点可控性)"""
    X, Y = m.profile(-0.040, 0.0, 'harmonic', s2=-0.015)
    gaps, _, uu = m.mesh_state(X, Y, 0.0, m.ROT_SIGN)
    u_min = uu[np.argmin(gaps)]
    assert min(abs(u_min - 0.25), abs(u_min - 0.75)) < 0.10, f"tightest at u={u_min:.2f}"

def test_unknown_variant():
    try:
        m.profile(0, 0, 'typo')
    except ValueError:
        return
    raise AssertionError("unknown variant should raise ValueError")

if __name__ == '__main__':
    for fn in (test_conjugate, test_harmonic_uniform, test_harmonic_midflank, test_unknown_variant):
        fn(); print(f"  PASS {fn.__name__}")
    print("ALL TESTS PASS")
