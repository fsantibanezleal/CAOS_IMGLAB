# Methods, the representation families

ImageLab carries one image across twelve families of mathematical representation, ordered along the editability
curve. Each family is a tab in the app; each tab's Method sub-tab transcribes the theory below with rendered
equations and references. A representation is a way to write an image as parameters; the question every tab asks
is what a perturbation of those parameters does.

## 1. Orthonormal transforms (live)

Fourier, DCT and wavelets write the image in a fixed orthonormal basis: `x = sum_k c_k phi_k`, with coefficients
`c_k = <x, phi_k>`. The basis is global and complete, so the map is exact and invertible. Editing is exact and
predictable per coefficient, but a single coefficient is spatially spread (a Fourier coefficient is a global
grating; a DCT coefficient is a per-block frequency; a wavelet coefficient is local in both space and scale). The
tabs let you keep the top-k coefficients, zero bands, and quantize (the JPEG path), reading the rate/distortion
tradeoff live. The KLT (PCA) tab replaces the fixed basis with the data-optimal basis learned from image patches,
the orthonormal transform with the best energy compaction for this image statistics.

References: Ahmed, Natarajan and Rao 1974 (DCT); Mallat 1989 (wavelets); Wallace 1992 (JPEG).

## 2. Overcomplete frames + sparse dictionaries (live)

Drop the orthonormal constraint: use a dictionary `D` with more atoms than pixels and represent the image with a
sparse code, `min ||a||_0 s.t. x approx D a`. Orthogonal Matching Pursuit picks atoms greedily. A learned
dictionary (from patches) or an overcomplete DCT gives atoms that match real image structure, so a handful of
atoms reconstruct a patch. Editing is local and semantic per atom, and this is the first pole of high editability:
the atoms are a designed, interpretable structure.

References: Mallat and Zhang 1993 (matching pursuit); Aharon, Elad and Bruckstein 2006 (K-SVD).

## 3. Geometric primitives (live)

Approximate the image with an ordered list of translucent shapes (ellipses), fit greedily to reduce the residual.
Each shape is an independent, meaningful, local coordinate (position, size, orientation, colour, opacity), so this
is the cleanest semantic-local representation: move one ellipse and only that region changes. The tab renders the
first k shapes to show the image build up shape by shape and reads the PSNR of the partial reconstruction.

Reference: the evolutionary-primitives line of work (Johansson's "EvoLisa", 2008, and successors).

## 4. Implicit neural field (offline train, live GPU forward pass)

Fit a small coordinate network (SIREN, a sinusoidal-activation MLP) so that `f_theta(x, y) approx image(x, y)`.
The image becomes the weights `theta`, a continuous, resolution-free representation. Training is offline; the
forward pass runs live on the GPU (a WebGL2 fragment shader evaluates the MLP per pixel). Editing the weights or
the input frequency scales the image globally and smoothly, but the parameters are entangled: no single weight is
a named handle.

References: Sitzmann et al. 2020 (SIREN); Tancik et al. 2020 (Fourier features).

## 5. Symbolic closed-form equation (offline fit, live shader + written equation)

Each image is fitted as an explicit trigonometric formula by ridge regression on random Fourier features:
`ch(x, y) = a0 + sum_k [ a_k cos(omega_k . (x, y)) + b_k sin(omega_k . (x, y)) ]`, with D = 512 random
frequencies shared across the three channels. Unlike the fixed-basis transforms the frequencies are random, and
unlike the neural field the model is linear in known analytic basis functions, so the picture literally IS a
readable equation: the tab renders it per pixel in a WebGL2 shader, shows the actual fitted terms with their
real coefficients (amplitude-phase form), and exports the complete formula as text. Fidelity is honest and
bounded: a smooth gradient reaches about 57 dB from the same 512 terms, a hard-edged checkerboard only about 14,
because a finite trigonometric sum cannot render a discontinuity.

References: Tancik et al. 2020 (Fourier features); Naderi Yeganeh (hand-authored formula art); Stanley 2007
(CPPNs, the generative-formula ancestor); Cranmer 2023 (symbolic regression).

## 6. Gabor atoms (offline matching pursuit, live shader + written equation)

The image is decomposed over a redundant dictionary of Gabor functions by greedy matching pursuit: each term
is a Gaussian envelope times an oriented cosine, `g_k = exp(-u^2/(2 sx^2) - v^2/(2 sy^2)) cos(om u - ph)` with
`(u, v) = R_theta ((x, y) - mu)`, the per-channel amplitude and phase solved in closed form on the quadrature
pair. 250 atoms per image, all 18 baked. Localized wave packets buy markedly more fidelity per parameter than
the global trig fit on photographs, and every term is a legible object: position, width, orientation,
frequency, phase. The tab renders the sum live in a WebGL2 shader, builds the image atom by atom, writes the
equation with its real numbers, and exports every atom.

References: Mallat and Zhang 1993 (matching pursuit); Daugman 1985 (2D Gabor filters).

## 7. Gaussian mixture, 2D splatting (offline gradient fit, live shader + written equation)

The image is one equation: a sum of colored anisotropic Gaussians,
`ch(x, y) = b_ch + sum_k c_k,ch exp(-1/2 d_k^T Sigma_k^-1 d_k)`, with the precision parameterized by its
Cholesky factor and all 200 Gaussians optimized jointly with Adam (the accumulated-sum variant of 2D Gaussian
splatting for images, the image counterpart of the representation behind real-time radiance fields). All 18
baked. The tab renders the mixture live, adds bumps by color mass, writes the equation and exports every
Gaussian.

References: Zhang et al. 2024 (GaussianImage, ECCV); Kerbl et al. 2023 (3D Gaussian splatting).

## 8. Radial basis functions, thin-plate spline (offline solve, live shader + written equation)

The image is written as a linear combination of the same thin-plate radial kernel centered on a fixed grid,
plus an affine plane: `ch(x, y) = a0 + a1 x + a2 y + sum_i w_i,ch phi(||(x,y) - c_i||)` with `phi(r) = r^2 log r`.
Unlike the Gaussian mixture (free anisotropic bumps found by gradient descent), the centers and kernel are
FIXED and only the linear weights are fitted, in closed form by ridge-regularized least squares (one linear
solve, ~0.2 s). The thin-plate spline is the smoothest interpolant of scattered data; broad content is
captured cleanly and sharp edges soften, the honest signature of a smooth interpolation equation. All 18
baked; rendered live per pixel.

References: Bookstein 1989 (thin-plate splines); Hardy 1971 (multiquadrics, the origin of radial basis functions).

## 9. Chebyshev polynomial series (fitted LIVE in the browser)

Each channel is written as a truncated tensor polynomial series, `ch(x, y) = sum_ij a_ij T_j(x) T_i(y)` with
`T_k(t) = cos(k arccos t)`, fitted by least squares with a discretely orthonormalized basis per axis (the
discrete-orthogonal-moments idea) and rotated back to the plain Chebyshev basis so the written equation stays
legible. This is the only equation family fitted entirely live, so it works on runtime uploads too; the degree
slider recomputes the fit in the browser. Fidelity saturates on hard edges, the classical moments trade-off.

Reference: Mukundan et al. 2001 (Tchebichef moments).

## 10. Fourier descriptors / epicycles (live)

The dominant closed contour of the selected image is traced (Otsu threshold, largest connected component,
Moore-neighbour boundary following), resampled by arc length, and transformed: the outline becomes a sum of
rotating circles, `z(t) = sum_k c_k e^{i f_k t}`. The coefficients are an exact, orderable parametric
description of the contour: the tab reconstructs the outline from the largest k epicycles, shows the actual
equation with its real amplitudes, frequencies and phases, and exports every kept term. Because a contour is a
one-dimensional closed curve this reduction is exact in the limit, the honest end of image-to-equation.

Reference: the classical Fourier-descriptor shape literature (Zahn and Roskies 1972).

## 11. Gielis superformula (shape as one famous equation, live fit)

The dominant silhouette of the selected image is reduced to a radial profile r(theta) about its centroid and
fitted by the single Gielis superformula,
`r(theta) = ( |cos(m theta/4)/a|^n2 + |sin(m theta/4)/b|^n3 )^(-1/n1)`, whose one shape parameter m sets the
symmetry and three exponents set the sharpness (fitted live: best scale in closed form, exponents by
coordinate descent, m by search). Symmetric figures (the rose, the star) collapse to an almost exact compact
formula; an irregular photo silhouette gets its best m-fold-symmetric superformula. Contrast the epicycle tab,
which writes the contour as an exact but many-term Fourier series: this is one line with five numbers.

Reference: Gielis 2003 (the superformula).

## 12. Learned generative latents (offline bake, live scrub)

An autoencoder or diffusion model maps the selected image to a low-dimensional latent and back: `z = E(x)`,
`x_hat = D(z)`. The VAE tab shows this image's own reconstruction (frame 0) and then decodes increasing
perturbations of its latent, `x_tilde = D(z + sigma epsilon)`: the picture drifts to plausible but globally
different images. The diffusion tab regenerates the selected image with SD-Turbo image-to-image at increasing
strength: low strength returns almost the original, high strength lets the learned prior re-imagine it. This is
the second pole of high editability: a latent nudge is semantic (it moves along the learned manifold) but
entangled (the whole image changes together). Both are baked offline per image (the models are too heavy for the
browser) and replayed, honestly labelled as generative reconstruction rather than a faithful edit.

References: Kingma and Welling 2013 (VAE); Karras et al. 2019 (StyleGAN); Harkonen et al. 2020 (GANSpace); Rombach
et al. 2022 (latent diffusion); Sauer et al. 2023 (adversarial diffusion distillation).
