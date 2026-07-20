import type { Citation } from '@fasl-work/caos-app-shell';

// The reference spine, transcribed from the persisted research (all verified against a primary source during
// the 2026-07-17 research pass). Grows as each representation tab lands. Inline <Cite id="..." /> resolves
// against this list via the CitationsProvider at the app root.
export const CITATIONS: Citation[] = [
  // --- the thesis anchors ---
  {
    id: 'fer2025',
    label: 'Kumar et al. 2025',
    citation:
      'Kumar A., Clune J., Lehman J., Stanley K. O. (2025). Questioning Representational Optimism in Deep Learning: The Fractured Entangled Representation Hypothesis.',
    url: 'https://arxiv.org/abs/2505.11581',
  },
  {
    id: 'yeganeh2024',
    label: 'Naderi Yeganeh 2024',
    citation:
      'Naderi Yeganeh H. (2024). Using Mathematical Formulas to Draw Figures. Math Horizons 31(4).',
    doi: '10.1080/10724117.2024.2368373',
  },
  // --- orthonormal transforms ---
  {
    id: 'cooley1965fft',
    label: 'Cooley & Tukey 1965',
    citation:
      'Cooley J. W., Tukey J. W. (1965). An algorithm for the machine calculation of complex Fourier series. Mathematics of Computation 19.',
    doi: '10.1090/S0025-5718-1965-0178586-1',
  },
  {
    id: 'oppenheim1981phase',
    label: 'Oppenheim & Lim 1981',
    citation: 'Oppenheim A. V., Lim J. S. (1981). The importance of phase in signals. Proc. IEEE 69(5).',
    doi: '10.1109/PROC.1981.12022',
  },
  {
    id: 'ahmed1974dct',
    label: 'Ahmed et al. 1974',
    citation:
      'Ahmed N., Natarajan T., Rao K. R. (1974). Discrete Cosine Transform. IEEE Trans. Computers C-23(1).',
    doi: '10.1109/T-C.1974.223784',
  },
  {
    id: 'wallace1991jpeg',
    label: 'Wallace 1991',
    citation: 'Wallace G. K. (1991). The JPEG still picture compression standard. Comm. ACM 34(4).',
    doi: '10.1145/103085.103089',
  },
  {
    id: 'mallat1989mra',
    label: 'Mallat 1989',
    citation:
      'Mallat S. G. (1989). A theory for multiresolution signal decomposition: the wavelet representation. IEEE Trans. PAMI 11(7).',
    doi: '10.1109/34.192463',
  },
  {
    id: 'daubechies1988',
    label: 'Daubechies 1988',
    citation:
      'Daubechies I. (1988). Orthonormal bases of compactly supported wavelets. Comm. Pure Appl. Math. 41(7).',
    doi: '10.1002/cpa.3160410705',
  },
  // --- frames + sparse dictionaries ---
  {
    id: 'olshausen1996',
    label: 'Olshausen & Field 1996',
    citation:
      'Olshausen B. A., Field D. J. (1996). Emergence of simple-cell receptive field properties by learning a sparse code for natural images. Nature 381.',
    doi: '10.1038/381607a0',
  },
  {
    id: 'aharon2006ksvd',
    label: 'Aharon et al. 2006',
    citation:
      'Aharon M., Elad M., Bruckstein A. (2006). K-SVD: An algorithm for designing overcomplete dictionaries for sparse representation. IEEE Trans. Signal Processing 54(11).',
    doi: '10.1109/TSP.2006.881199',
  },
  {
    id: 'tang2007haar',
    label: 'Tang et al. 2007',
    citation:
      'Tang F., Crabb R., Tao H. (2007). Representing images using nonorthogonal Haar-like bases. IEEE Trans. PAMI 29(12).',
    doi: '10.1109/TPAMI.2007.1123',
  },
  {
    id: 'donoho2006cs',
    label: 'Donoho 2006',
    citation: 'Donoho D. L. (2006). Compressed sensing. IEEE Trans. Information Theory 52(4).',
    doi: '10.1109/TIT.2006.871582',
  },
  {
    id: 'li2020diffvg',
    label: 'Li et al. 2020',
    citation:
      'Li T.-M., Lukac M., Gharbi M., Ragan-Kelley J. (2020). Differentiable Vector Graphics Rasterization for Editing and Learning. ACM Trans. Graphics 39(6) (SIGGRAPH Asia).',
    doi: '10.1145/3414685.3417871',
  },
  // --- implicit neural representations ---
  {
    id: 'sitzmann2020siren',
    label: 'Sitzmann et al. 2020',
    citation:
      'Sitzmann V., Martel J., Bergman A., Lindell D., Wetzstein G. (2020). Implicit Neural Representations with Periodic Activation Functions (SIREN). NeurIPS.',
    url: 'https://arxiv.org/abs/2006.09661',
  },
  {
    id: 'tancik2020fourier',
    label: 'Tancik et al. 2020',
    citation:
      'Tancik M. et al. (2020). Fourier Features Let Networks Learn High Frequency Functions in Low Dimensional Domains. NeurIPS.',
    url: 'https://arxiv.org/abs/2006.10739',
  },
  {
    id: 'dupont2021coin',
    label: 'Dupont et al. 2021',
    citation: 'Dupont E. et al. (2021). COIN: COmpression with Implicit Neural representations. arXiv.',
    url: 'https://arxiv.org/abs/2103.03123',
  },
  // --- symbolic / CPPN ---
  {
    id: 'stanley2007cppn',
    label: 'Stanley 2007',
    citation:
      'Stanley K. O. (2007). Compositional pattern producing networks: A novel abstraction of development. Genetic Programming and Evolvable Machines 8.',
    doi: '10.1007/s10710-007-9028-8',
  },
  {
    id: 'cranmer2023pysr',
    label: 'Cranmer 2023',
    citation:
      'Cranmer M. (2023). Interpretable Machine Learning for Science with PySR and SymbolicRegression.jl. arXiv.',
    url: 'https://arxiv.org/abs/2305.01582',
  },
  // --- generative latents + diffusion ---
  {
    id: 'kingma2013vae',
    label: 'Kingma & Welling 2013',
    citation: 'Kingma D. P., Welling M. (2013). Auto-Encoding Variational Bayes. arXiv.',
    url: 'https://arxiv.org/abs/1312.6114',
  },
  {
    id: 'karras2019stylegan',
    label: 'Karras et al. 2019',
    citation:
      'Karras T., Laine S., Aila T. (2019). A Style-Based Generator Architecture for Generative Adversarial Networks (StyleGAN). CVPR.',
    url: 'https://arxiv.org/abs/1812.04948',
  },
  {
    id: 'harkonen2020ganspace',
    label: 'Harkonen et al. 2020',
    citation:
      'Harkonen E., Hertzmann A., Lehtinen J., Paris S. (2020). GANSpace: Discovering Interpretable GAN Controls. NeurIPS.',
    url: 'https://arxiv.org/abs/2004.02546',
  },
  {
    id: 'ho2020ddpm',
    label: 'Ho et al. 2020',
    citation: 'Ho J., Jain A., Abbeel P. (2020). Denoising Diffusion Probabilistic Models. NeurIPS.',
    url: 'https://arxiv.org/abs/2006.11239',
  },
  {
    id: 'rombach2022ldm',
    label: 'Rombach et al. 2022',
    citation:
      'Rombach R., Blattmann A., Lorenz D., Esser P., Ommer B. (2022). High-Resolution Image Synthesis with Latent Diffusion Models. CVPR.',
    url: 'https://arxiv.org/abs/2112.10752',
  },
  {
    id: 'sauer2023add',
    label: 'Sauer et al. 2023',
    citation:
      'Sauer A., Lorenz D., Blattmann A., Rombach R. (2023). Adversarial Diffusion Distillation (SD-Turbo). arXiv.',
    url: 'https://arxiv.org/abs/2311.17042',
  },
  {
    id: 'cheng2023diss',
    label: 'Cheng et al. 2023',
    citation:
      'Cheng S.-I. et al. (2023). Adaptively-Realistic Image Generation from Stroke and Sketch with Diffusion Model (DiSS). WACV.',
    url: 'https://arxiv.org/abs/2208.12675',
  },
  // --- evaluation metrics ---
  {
    id: 'wang2004ssim',
    label: 'Wang et al. 2004',
    citation:
      'Wang Z., Bovik A. C., Sheikh H. R., Simoncelli E. P. (2004). Image quality assessment: from error visibility to structural similarity (SSIM). IEEE Trans. Image Processing 13(4).',
    doi: '10.1109/TIP.2003.819861',
  },
  {
    id: 'zhang2018lpips',
    label: 'Zhang et al. 2018',
    citation:
      'Zhang R., Isola P., Efros A. A., Shechtman E., Wang O. (2018). The Unreasonable Effectiveness of Deep Features as a Perceptual Metric (LPIPS). CVPR.',
    url: 'https://arxiv.org/abs/1801.03924',
  },
];
